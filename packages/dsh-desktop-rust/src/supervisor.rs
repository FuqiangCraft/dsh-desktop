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

pub struct HostSupervisor {
    child: Child,
    stdin: ChildStdin,
}

impl HostSupervisor {
    pub fn start(
        node_binary: &Path,
        sidecar_entry: &Path,
        startup_timeout: Duration,
    ) -> Result<(Self, ReadyHost), SupervisorError> {
        let mut command = Command::new(node_binary);
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

        Ok((Self { child, stdin }, ready))
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
