//! DeepSeek Harness Desktop — a native shell embedding the dsh web UI
//! with resilient daemon spawning, a recent-session system tray, and a
//! transparent floating desktop pet companion.

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct DesktopSettingsPayload {
    pub pet_enabled: bool,
    pub pet_character: String,
    pub pet_size: u32,
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
fn sync_desktop_settings(app: AppHandle, settings: DesktopSettingsPayload) -> Result<(), String> {
    if let Some(pet_window) = app.get_webview_window("pet") {
        if settings.pet_enabled {
            let _ = pet_window.show();
        } else {
            let _ = pet_window.hide();
        }
        let character = match settings.pet_character.as_str() {
            "whale" => "whale",
            "cat" => "cat",
            "woodfish" => "woodfish",
            _ => "robot",
        };
        let _ = pet_window.eval(format!(
            "window.__DSH_SET_PET_CHARACTER__?.('{character}'); window.__DSH_SET_PET_SIZE__?.({});",
            settings.pet_size.clamp(60, 140)
        ));
    }
    Ok(())
}

fn pet_resource_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or_else(|| "无法确定用户目录".to_string())?;
    let path = std::path::PathBuf::from(home).join(".dsh").join("pets");
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

#[tauri::command]
fn get_pet_resource_path() -> Result<String, String> {
    pet_resource_path().map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_pet_resource_folder() -> Result<(), String> {
    let path = pet_resource_path()?;
    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|error| error.to_string())?;
    #[cfg(all(unix, not(target_os = "macos")))]
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn toggle_pet_window(app: AppHandle) -> Result<bool, String> {
    if let Some(pet_window) = app.get_webview_window("pet") {
        let is_visible = pet_window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = pet_window.hide();
            Ok(false)
        } else {
            let _ = pet_window.show();
            let _ = pet_window.set_focus();
            Ok(true)
        }
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn play_notification_sound(app: AppHandle, kind: Option<String>) -> Result<(), String> {
    if let Some(pet_window) = app.get_webview_window("pet") {
        let kind_str = kind.unwrap_or_else(|| "success".to_string());
        if kind_str == "alert" {
            let _ = pet_window.eval("SoundFX?.playAlert?.()");
        } else {
            let _ = pet_window.eval("SoundFX?.playSuccess?.()");
        }
    }
    Ok(())
}

#[tauri::command]
fn restore_main_window_from_pet(app: AppHandle) -> Result<(), String> {
    restore_main_window(&app, false);
    Ok(())
}

#[tauri::command]
fn update_pet_state(app: AppHandle, state: String, text: Option<String>) -> Result<(), String> {
    if let Some(pet_window) = app.get_webview_window("pet") {
        let text_json = serde_json::to_string(&text.unwrap_or_default()).unwrap_or_default();
        let _ = pet_window.eval(format!(
            "window.__DSH_SET_PET_STATE__?.('{state}', {text_json});"
        ));
    }
    Ok(())
}

#[tauri::command]
fn start_dragging_pet(app: AppHandle) -> Result<(), String> {
    if let Some(pet_window) = app.get_webview_window("pet") {
        let _ = pet_window.start_dragging();
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
            retry_spawn_dsh,
            sync_desktop_settings,
            get_pet_resource_path,
            open_pet_resource_folder,
            toggle_pet_window,
            play_notification_sound,
            restore_main_window_from_pet,
            update_pet_state,
            start_dragging_pet
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

            let main_window = tauri::WebviewWindowBuilder::new(app, "main", main_url)
                .title("DSH Desktop")
                .inner_size(1280.0, 840.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .visible(true)
                .focused(true)
                .build()?;
            let _ = main_window.show();
            let _ = main_window.unminimize();
            let _ = main_window.set_focus();

            // 4. Companion Pet floating window positioned at bottom-right corner of screen
            let mut pet_builder = tauri::WebviewWindowBuilder::new(
                app,
                "pet",
                WebviewUrl::App("pet.html".into()),
            )
            .title("DSH Desktop Pet")
            .inner_size(176.0, 190.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .visible(true);

            if let Ok(Some(monitor)) = app.primary_monitor() {
                let size = monitor.size();
                let scale = monitor.scale_factor();
                let screen_w = size.width as f64 / scale;
                let screen_h = size.height as f64 / scale;
                pet_builder = pet_builder.position(screen_w - 210.0, screen_h - 250.0);
            } else {
                pet_builder = pet_builder.center();
            }

            let pet_window = pet_builder.build()?;
            let _ = pet_window.show();
            let _ = pet_window.unminimize();
            let _ = pet_window.set_focus();

            // 5. ChatGPT-style tray menu: recent chats, companion toggle, primary actions, quit.
            let recent_empty = MenuItem::with_id(app, "recent-empty", "暂无最近会话", false, None::<&str>)?;
            let recent = Submenu::with_id_and_items(app, "recent", "最近会话", true, &[&recent_empty])?;
            let show = MenuItem::with_id(app, "show", "打开 DSH Desktop", true, None::<&str>)?;
            let toggle_pet = MenuItem::with_id(app, "toggle-pet", "桌面伴侣", true, None::<&str>)?;
            let new_chat = MenuItem::with_id(app, "new-chat", "新建会话", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let separator_top = PredefinedMenuItem::separator(app)?;
            let separator_bottom = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[&recent, &separator_top, &show, &toggle_pet, &new_chat, &separator_bottom, &quit_item],
            )?;
            app.manage(RecentMenu(recent));

            let tray_icon = tauri::include_image!("icons/32x32.png");

            let tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("DeepSeek Harness Desktop")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(move |tray, event| {
                    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            restore_main_window(tray.app_handle(), false);
                        }
                        TrayIconEvent::DoubleClick {
                            button: MouseButton::Left,
                            ..
                        } => {
                            restore_main_window(tray.app_handle(), false);
                        }
                        _ => {}
                    }
                })
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        restore_main_window(app, false);
                    }
                    "toggle-pet" => {
                        let _ = toggle_pet_window(app.clone());
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
                if window.label() == "main" || window.label() == "pet" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running DeepSeek Harness Desktop");
}
