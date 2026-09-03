use std::{
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc,
    thread,
    time::Duration,
};

use thiserror::Error;

use crate::protocol::{HostCommand, PROTOCOL_VERSION, SidecarEvent};

#[derive(Debug, Error)]
pub enum SupervisorError {
    #[error("failed to start DSH sidecar: {0}")]
    Spawn(#[source] std::io::Error),
    #[error("DSH sidecar did not become ready within {0:?}")]
    StartupTimeout(Duration),
    #[error("DSH sidecar closed its protocol stream before becoming ready")]
    ProtocolClosed,
    #[error("invalid sidecar protocol message: {0}")]
    InvalidMessage(#[from] serde_json::Error),
    #[error("sidecar protocol version {actual} is incompatible with host version {expected}")]
    VersionMismatch { expected: u16, actual: u16 },
    #[error("DSH sidecar reported a startup failure: {0}")]
    Sidecar(String),
    #[error("sidecar stdin is unavailable")]
    MissingStdin,
    #[error("failed to send sidecar command: {0}")]
    Send(#[source] std::io::Error),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadyHost {
    pub origin: String,
    pub port: u16,
    pub generation: String,
}

#[cfg(windows)]
mod windows_job {
    use std::mem;
    use std::os::windows::io::RawHandle;

    type HANDLE = *mut std::ffi::c_void;
    type BOOL = i32;
    type DWORD = u32;

    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: DWORD = 0x2000;
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: u32 = 9;

    #[repr(C)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: DWORD,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: DWORD,
        affinity: usize,
        priority_class: DWORD,
        scheduling_class: DWORD,
    }

    #[repr(C)]
    struct IO_COUNTERS {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        io_info: IO_COUNTERS,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_limit: usize,
        peak_job_memory_limit: usize,
    }

    unsafe extern "system" {
        fn CreateJobObjectW(lpJobAttributes: *mut std::ffi::c_void, lpName: *const u16) -> HANDLE;
        fn SetInformationJobObject(
            hJob: HANDLE,
            JobObjectInformationClass: u32,
            lpJobObjectInformation: *const std::ffi::c_void,
            cbJobObjectInformationLength: DWORD,
        ) -> BOOL;
        fn AssignProcessToJobObject(hJob: HANDLE, hProcess: HANDLE) -> BOOL;
        fn CloseHandle(hObject: HANDLE) -> BOOL;
    }

    pub struct JobObject {
        handle: HANDLE,
    }

    unsafe impl Send for JobObject {}
    unsafe impl Sync for JobObject {}

    impl JobObject {
        pub fn create_kill_on_close() -> Option<Self> {
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
                if handle.is_null() {
                    return None;
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = mem::zeroed();
                info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let res = SetInformationJobObject(
                    handle,
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                    &info as *const _ as *const _,
                    mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as DWORD,
                );
                if res == 0 {
                    CloseHandle(handle);
                    return None;
                }
                Some(Self { handle })
            }
        }

        pub fn assign_process(&self, process_handle: RawHandle) -> bool {
            unsafe { AssignProcessToJobObject(self.handle, process_handle as HANDLE) != 0 }
        }
    }

    impl Drop for JobObject {
        fn drop(&mut self) {
            unsafe {
                if !self.handle.is_null() {
                    CloseHandle(self.handle);
                }
            }
        }
    }
}

pub struct HostSupervisor {
    child: Child,
    stdin: ChildStdin,
    #[cfg(windows)]
    _job: Option<windows_job::JobObject>,
}

impl HostSupervisor {
    pub fn start(
        node_binary: &Path,
        sidecar_entry: &Path,
        startup_timeout: Duration,
    ) -> Result<(Self, ReadyHost), SupervisorError> {
        let mut command = Command::new(node_binary);
        if let Some(parent) = sidecar_entry.parent().and_then(|p| p.parent()).and_then(|p| p.parent()) {
            if parent.exists() {
                command.current_dir(parent);
            }
        } else if let Ok(cwd) = std::env::current_dir() {
            command.current_dir(cwd);
        }
        command
            .arg(sidecar_entry)
            .env("DSH_SIDECAR_PROTOCOL", PROTOCOL_VERSION.to_string())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const DETACHED_PROCESS: u32 = 0x0000_0008;
            command.creation_flags(DETACHED_PROCESS);
        }
        let mut child = command.spawn().map_err(SupervisorError::Spawn)?;

        #[cfg(windows)]
        let job = {
            use std::os::windows::io::AsRawHandle;
            let job = windows_job::JobObject::create_kill_on_close();
            if let Some(ref j) = job {
                let _ = j.assign_process(child.as_raw_handle());
            }
            job
        };

        let stdin = child.stdin.take().ok_or(SupervisorError::MissingStdin)?;
        let stdout = child.stdout.take().ok_or(SupervisorError::ProtocolClosed)?;
        let (sender, receiver) = mpsc::sync_channel(1);
        thread::spawn(move || {
            let line = BufReader::new(stdout).lines().next().transpose();
            let _ = sender.send(line);
        });

        let line = match receiver.recv_timeout(startup_timeout) {
            Ok(Ok(Some(line))) => line,
            Ok(Ok(None)) => return startup_failure(child, SupervisorError::ProtocolClosed),
            Ok(Err(error)) => return startup_failure(child, SupervisorError::Spawn(error)),
            Err(_) => {
                return startup_failure(child, SupervisorError::StartupTimeout(startup_timeout));
            }
        };
        let event: SidecarEvent = match serde_json::from_str(&line) {
            Ok(event) => event,
            Err(error) => return startup_failure(child, SupervisorError::InvalidMessage(error)),
        };

        let ready = match event {
            SidecarEvent::Ready {
                protocol,
                origin,
                port,
                generation,
            } => {
                if protocol != PROTOCOL_VERSION {
                    return startup_failure(
                        child,
                        SupervisorError::VersionMismatch {
                            expected: PROTOCOL_VERSION,
                            actual: protocol,
                        },
                    );
                }
                ReadyHost {
                    origin,
                    port,
                    generation,
                }
            }
            SidecarEvent::Error { message, .. } => {
                return startup_failure(child, SupervisorError::Sidecar(message));
            }
            SidecarEvent::Stopped { .. } => {
                return startup_failure(child, SupervisorError::ProtocolClosed);
            }
        };

        Ok((
            Self {
                child,
                stdin,
                #[cfg(windows)]
                _job: job,
            },
            ready,
        ))
    }

    pub fn shutdown(mut self, timeout: Duration) -> Result<(), SupervisorError> {
        let payload = serde_json::to_string(&HostCommand::shutdown())?;
        writeln!(self.stdin, "{payload}").map_err(SupervisorError::Send)?;

        let started = std::time::Instant::now();
        while started.elapsed() < timeout {
            if self
                .child
                .try_wait()
                .map_err(SupervisorError::Spawn)?
                .is_some()
            {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(25));
        }

        // A wedged plugin must not keep the native desktop process alive.
        self.child.kill().map_err(SupervisorError::Spawn)?;
        let _ = self.child.wait();
        Ok(())
    }
}

fn startup_failure<T>(mut child: Child, error: SupervisorError) -> Result<T, SupervisorError> {
    let _ = child.kill();
    let _ = child.wait();
    Err(error)
}

impl Drop for HostSupervisor {
    fn drop(&mut self) {
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::windows_job::JobObject;

    #[test]
    fn creates_job_object_with_kill_on_close() {
        let job = JobObject::create_kill_on_close();
        assert!(
            job.is_some(),
            "Windows Job Object with kill-on-close should create successfully"
        );
    }
}

