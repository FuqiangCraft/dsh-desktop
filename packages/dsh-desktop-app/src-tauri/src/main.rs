//! DeepSeek Harness Desktop — a native shell embedding the dsh web UI
//! with resilient daemon spawning and a recent-session system tray.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Manager, WebviewUrl, WindowEvent, Wry,
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

/// Spawn the dsh host server using the default `web` profile.
/// Probes standard PATH, falling back gracefully if not found.
fn spawn_server(patch_path: &Path) -> Option<Child> {
    let mut command = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/C", "dsh", "--profile", "web", "--patch"])
            .arg(patch_path);
        c
    } else {
        let mut c = Command::new("dsh");
        c.args(["--profile", "web", "--patch"]).arg(patch_path);
        c
    };

    command
        .env("BROWSER", "none")
        .stdin(std::process::Stdio::null())
        .spawn()
        .ok()
}

/// Terminate the complete DSH process tree.
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

/// Restore the main window from both tray-hidden and Windows-minimized states.
fn restore_main_window(app: &AppHandle, new_chat: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if new_chat {
            let _ = window.eval("window.__DSH_DESKTOP_NEW_CHAT__?.()");
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentSessionPayload {
    pub id: String,
    pub title: String,
}

struct RecentMenu(Submenu<Wry>);

#[tauri::command]
fn sync_recent_sessions(
    app: AppHandle,
    sessions: Vec<RecentSessionPayload>,
) -> Result<(), String> {
    let state = app
        .try_state::<RecentMenu>()
        .ok_or_else(|| "recent sessions menu is unavailable".to_string())?;

    while state.0.remove_at(0).map_err(|error| error.to_string())?.is_some() {}

    if sessions.is_empty() {
        let empty = MenuItem::with_id(&app, "recent-empty", "暂无最近会话", false, None::<&str>)
            .map_err(|error| error.to_string())?;
        state.0.append(&empty).map_err(|error| error.to_string())?;
        return Ok(());
    }

    for session in sessions.into_iter().take(5) {
        let title = session.title.chars().take(42).collect::<String>();
        let item = MenuItem::with_id(
            &app,
            format!("recent:{}", session.id),
            title,
            true,
            None::<&str>,
        )
        .map_err(|error| error.to_string())?;
        state.0.append(&item).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn retry_spawn_dsh(app: AppHandle) -> Result<bool, String> {
    if server_ready() {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.navigate(SERVER_ORIGIN.parse().expect("static origin"));
        }
        return Ok(true);
    }

    if let Some(state) = app.try_state::<ServerChild>() {
        if let Ok(mut guard) = state.0.lock() {
            if guard.is_none() {
                let patch_path = app
                    .path()
                    .resource_dir()
                    .map_err(|error| error.to_string())?
                    .join("desktop.patch.yml");
                *guard = spawn_server(&patch_path);
            }
        }
    }

    // Wait up to 3 seconds for reconnection
    let mut attempts = 0u32;
    while !server_ready() && attempts < 30 {
        attempts += 1;
        thread::sleep(Duration::from_millis(100));
    }

    let ready = server_ready();
    if ready {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.navigate(SERVER_ORIGIN.parse().expect("static origin"));
        }
    }
    Ok(ready)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            sync_recent_sessions,
            retry_spawn_dsh
        ])
        .setup(|app| {
            // 1. Spawn dsh server if not already running.
            let patch_path = app.path().resource_dir()?.join("desktop.patch.yml");
            let child = if server_ready() {
                None
            } else {
                spawn_server(&patch_path)
            };
            app.manage(ServerChild(Mutex::new(child)));

            // 2. Poll up to ~3.5 seconds to see if DSH is available.
            let mut attempts = 0u32;
            while !server_ready() && attempts < 35 {
                attempts += 1;
                thread::sleep(Duration::from_millis(100));
            }

            // 3. Main window: load live server if ready, or fallback to setup wizard.
            let main_url = if server_ready() {
                WebviewUrl::External(SERVER_ORIGIN.parse().expect("static origin"))
            } else {
                WebviewUrl::App("index.html".into())
            };

            tauri::WebviewWindowBuilder::new(app, "main", main_url)
                .title("DSH Desktop")
                .inner_size(1280.0, 840.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .build()?;

            // 4. ChatGPT-style tray menu: recent chats, primary actions, quit.
            let recent_empty = MenuItem::with_id(app, "recent-empty", "暂无最近会话", false, None::<&str>)?;
            let recent = Submenu::with_id_and_items(app, "recent", "最近会话", true, &[&recent_empty])?;
            let show = MenuItem::with_id(app, "show", "打开 DSH Desktop", true, None::<&str>)?;
            let new_chat = MenuItem::with_id(app, "new-chat", "新建会话", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let separator_top = PredefinedMenuItem::separator(app)?;
            let separator_bottom = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[&recent, &separator_top, &show, &new_chat, &separator_bottom, &quit_item],
            )?;
            app.manage(RecentMenu(recent));

            let tray_icon = tauri::include_image!("icons/32x32.png");

            let tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("DeepSeek Harness Desktop")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_tray_icon_event(move |tray, event| {
                    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_main_window(tray.app_handle(), false);
                    }
                })
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        restore_main_window(app, false);
                    }
                    "new-chat" => {
                        restore_main_window(app, true);
                    }
                    "quit" => quit(app),
                    id if id.starts_with("recent:") => {
                        if let Some(window) = app.get_webview_window("main") {
                            let session_id = &id["recent:".len()..];
                            if let Ok(session_json) = serde_json::to_string(session_id) {
                                restore_main_window(app, false);
                                let _ = window.eval(format!(
                                    "window.__DSH_DESKTOP_OPEN_SESSION__?.({session_json})"
                                ));
                            }
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            app.manage(tray);

            Ok(())
        })
        .on_window_event(|window, event| {
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
