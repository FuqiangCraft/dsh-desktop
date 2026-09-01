use std::{env, path::PathBuf, process::ExitCode, time::Duration};

use dsh_desktop_host::supervisor::HostSupervisor;

fn main() -> ExitCode {
    let node = env::var_os("DSH_NODE_BINARY")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("node"));
    let sidecar = env::var_os("DSH_SIDECAR_ENTRY")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("packages/dsh-desktop-sidecar/dist/main.mjs"));

    let (supervisor, ready) = match HostSupervisor::start(&node, &sidecar, Duration::from_secs(30))
    {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{error}");
            return ExitCode::FAILURE;
        }
    };

    println!(
        "DSH host ready at {} (generation {})",
        ready.origin, ready.generation
    );
    println!("Press Enter to stop the host.");
    let mut input = String::new();
    let _ = std::io::stdin().read_line(&mut input);

    match supervisor.shutdown(Duration::from_secs(3)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("failed to stop DSH host: {error}");
            ExitCode::FAILURE
        }
    }
}
