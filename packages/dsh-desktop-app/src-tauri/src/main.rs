//! DeepSeek Harness Desktop — a thin native shell around the dsh web server.
//!
//! Spawns `dsh --profile web` (the DeepSeek Harness host, which loads the
//! dsh-desktop-plugin features into its UI), waits for the server to come up,
//! then opens a native window at http://127.0.0.1:3080. A system tray keeps
//! the harness running in the background: closing the window hides it, and
//! Quit terminates the server child.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, WebviewUrl, WindowEvent,
};

/// The spawned `dsh` server child, so the app can terminate it on quit.
struct ServerChild(Mutex<Option<Child>>);

impl Drop for ServerChild {
    fn drop(&mut self) {
        if let Ok(child) = self.0.get_mut() {
            if let Some(mut child) = child.take() {
                terminate_child(&mut child);
            }
        }
    }
}

/// The dsh web server origin the shell embeds.
const SERVER_ORIGIN: &str = "http://127.0.0.1:3080";

/// True when the dsh web server is accepting connections.
fn server_ready() -> bool {
    TcpStream::connect("127.0.0.1:3080").is_ok()
}

/// Spawn the dsh host server using the default `web` profile (which already
/// loads the dsh-desktop-plugin bundle). Returns the child handle, if any.
fn spawn_server() -> Option<Child> {
    let mut command = if cfg!(windows) {
        // The npm `dsh` shim resolves through cmd on Windows.
        let mut c = Command::new("cmd");
        c.args(["/C", "dsh --profile web"]);
        c
    } else {
        let mut c = Command::new("dsh");
        c.args(["--profile", "web"]);
        c
    };
    command
        .env("BROWSER", "none")
        .stdin(std::process::Stdio::null())
        .spawn()
        .ok()
}

/// Terminate the complete DSH process tree. On Windows the tracked child is
/// the `cmd.exe` npm shim, so killing only that process can orphan Node.
fn terminate_child(child: &mut Child) {
    #[cfg(windows)]
    {
        let pid = child.id().to_string();
        let _ = Command::new("taskkill")
            .args(["/PID", &pid, "/T", "/F"])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = child.kill();
    }
    let _ = child.wait();
}

/// Terminate the server child and exit the app.
fn quit(app: &AppHandle) {
    if let Some(state) = app.try_state::<ServerChild>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                terminate_child(&mut child);
            }
        }
    }
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 1. Spawn the dsh host server, then wait until it accepts connections.
            // Reuse an already-running local server; otherwise own its full
            // lifecycle and clean it up when the desktop app exits.
            let child = if server_ready() { None } else { spawn_server() };
            app.manage(ServerChild(Mutex::new(child)));

            let mut attempts = 0u32;
            while !server_ready() {
                if attempts >= 200 {
                    eprintln!("[desktop] dsh server did not become ready on {SERVER_ORIGIN}");
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        format!("dsh server did not become ready on {SERVER_ORIGIN}"),
                    )
                    .into());
                }
                attempts += 1;
                thread::sleep(Duration::from_millis(100));
            }

            // 2. Main window embedding the live dsh web UI.
            let url = WebviewUrl::External(SERVER_ORIGIN.parse().expect("static origin"));
            tauri::WebviewWindowBuilder::new(app, "main", url)
                .title("DSH Desktop")
                .inner_size(1280.0, 840.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .build()?;

            // 3. System tray: show / quit; the harness keeps running while hidden.
            let show = MenuItem::with_id(app, "show", "Show DSH Desktop", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit_item])?;

            // The TrayIcon handle must stay alive for the icon to remain
            // interactive — bind it so it is not dropped at the end of setup.
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("embedded app icon"))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(move |tray, event| {
                    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
                    // Left-click (and double-click) on Windows shows the window.
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => quit(app),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it to the tray instead of quitting.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running DeepSeek Harness Desktop");
}
