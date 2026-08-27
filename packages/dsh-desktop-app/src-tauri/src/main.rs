//! DeepSeek Harness Desktop — a native shell embedding the dsh web UI
//! with resilient daemon spawning, a recent-session system tray, and a
//! transparent floating desktop pet companion.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Manager, WebviewUrl, WindowEvent, Wry,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

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
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);

    command
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
        let visible = window.is_visible().unwrap_or(false);
        let minimized = window.is_minimized().unwrap_or(false);
        if !visible || minimized {
            // GTK can retain a native iconized state that `unminimize` alone
            // does not clear. Hiding first resets only minimized windows.
            #[cfg(target_os = "linux")]
            if minimized {
                let _ = window.hide();
            }
            let _ = window.unminimize();
            let _ = window.show();
        }
        let _ = window.set_focus();
        if new_chat {
            let win = window.clone();
            tauri::async_runtime::spawn(async move {
                let _ = win.eval("window.__DSH_DESKTOP_NEW_CHAT__?.()");
                #[cfg(target_os = "linux")]
                {
                    thread::sleep(Duration::from_millis(150));
                    let _ = win.eval("window.__DSH_DESKTOP_NEW_CHAT__?.()");
                }
            });
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentSessionPayload {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettingsPayload {
    pub pet_enabled: bool,
    pub pet_character: String,
    pub pet_size: u32,
}

impl Default for DesktopSettingsPayload {
    fn default() -> Self {
        Self {
            pet_enabled: true,
            pet_character: "robot".to_string(),
            pet_size: 100,
        }
    }
}

struct RecentMenu(Submenu<Wry>);

/// The tray's pet open/hide toggle, relabeled as the pet visibility changes.
struct PetToggleItem(MenuItem<Wry>);

/// The tray update action, disabled and relabeled while a check is running.
struct UpdateMenuItem(MenuItem<Wry>);

/// Pet window position persisted across launches.
#[derive(Debug, Serialize, Deserialize)]
struct SavedPetPosition {
    pub x: i32,
    pub y: i32,
}

/// Throttles writes of the pet window position during drags.
struct PetPositionSaver(Mutex<Option<Instant>>);

fn pet_position_file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("pet-position.json"))
}

fn read_pet_position(app: &AppHandle) -> Option<SavedPetPosition> {
    let file = pet_position_file(app).ok()?;
    std::fs::read_to_string(file)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
}

fn desktop_settings_file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("desktop-settings.json"))
}

fn read_desktop_settings(app: &AppHandle) -> DesktopSettingsPayload {
    desktop_settings_file(app)
        .ok()
        .and_then(|file| std::fs::read_to_string(file).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn get_desktop_settings(app: AppHandle) -> DesktopSettingsPayload {
    read_desktop_settings(&app)
}

/// Keep the tray's pet toggle label in sync with the pet window's visibility.
fn sync_pet_toggle_label(app: &AppHandle) {
    let Some(pet_window) = app.get_webview_window("pet") else { return };
    let visible = pet_window.is_visible().unwrap_or(false);
    let label = if visible { "隐藏宠物" } else { "打开宠物" };
    if let Some(item) = app.try_state::<PetToggleItem>() {
        let _ = item.0.set_text(label);
    }
}

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
    let normalized = DesktopSettingsPayload {
        pet_enabled: settings.pet_enabled,
        pet_character: match settings.pet_character.as_str() {
            "whale" => "whale".to_string(),
            "cat" => "cat".to_string(),
            custom if custom.starts_with("custom:") => custom.to_string(),
            _ => "robot".to_string(),
        },
        pet_size: settings.pet_size.clamp(60, 140),
    };
    let file = desktop_settings_file(&app)?;
    std::fs::write(&file, serde_json::to_string_pretty(&normalized).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    if let Some(pet_window) = app.get_webview_window("pet") {
        if normalized.pet_enabled {
            let _ = pet_window.show();
        } else {
            let _ = pet_window.hide();
        }
        sync_pet_toggle_label(&app);
        let character = normalized.pet_character;
        let character_json =
            serde_json::to_string(&character).unwrap_or_else(|_| "\"robot\"".to_string());
        let _ = pet_window.eval(format!(
            "window.__DSH_SET_PET_CHARACTER__?.({character_json}); window.__DSH_SET_PET_SIZE__?.({});",
            normalized.pet_size
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

/// Base64 data URL of a custom pet image placed in `~/.dsh/pets`.
#[tauri::command]
fn read_pet_resource(name: String) -> Result<String, String> {
    let dir = pet_resource_path()?;
    let safe = name
        .replace('/', "_")
        .replace('\\', "_")
        .replace("..", "_")
        .chars()
        .take(80)
        .collect::<String>();
    let file = dir.join(format!("{safe}.png"));
    if !file.is_file() {
        return Err(format!("自定义宠物 {name} 不存在"));
    }
    let bytes = std::fs::read(&file).map_err(|error| error.to_string())?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}

/// Names (file stems) of custom pets currently in `~/.dsh/pets`.
#[tauri::command]
fn list_pet_resources() -> Result<Vec<String>, String> {
    let dir = pet_resource_path()?;
    let mut names = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) == Some("png") {
            if let Some(name) = path.file_stem().and_then(|stem| stem.to_str()) {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
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

/// Format raw updater errors into friendly user-facing messages.
fn format_update_error(error: &str) -> String {
    let lower = error.to_lowercase();
    if lower.contains("could not fetch a valid release json")
        || lower.contains("404")
        || lower.contains("not found")
    {
        "当前已是最新版本，或官方远程仓库尚未发布新版本的更新包。".to_string()
    } else if lower.contains("network")
        || lower.contains("timeout")
        || lower.contains("timed out")
        || lower.contains("dns")
        || lower.contains("connect")
    {
        "网络连接异常，无法访问更新服务器，请检查网络连接后重试。".to_string()
    } else {
        format!("检查更新时发生错误：{error}")
    }
}

/// Check the configured release endpoint and install a newer signed build when available.
#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|error| error.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|error| format_update_error(&error.to_string()))?;

    let Some(update) = update else {
        return Ok(false);
    };

    let version = update.version.clone();
    let _ = app
        .dialog()
        .message(format!(
            "发现新版本 {version}。点击确定后将自动下载并安装，完成后应用会自动重启。"
        ))
        .kind(MessageDialogKind::Info)
        .title("DSH Desktop 更新")
        .blocking_show();

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;

    app.restart();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            restore_main_window(app, false);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            sync_recent_sessions,
            retry_spawn_dsh,
            sync_desktop_settings,
            get_desktop_settings,
            get_pet_resource_path,
            open_pet_resource_folder,
            list_pet_resources,
            read_pet_resource,
            update_pet_state,
            start_dragging_pet,
            check_for_updates
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

            // Seed the pet-position throttle so the pet's own startup moves
            // (default placement, then the saved position) never clobber the file.
            app.manage(PetPositionSaver(Mutex::new(Some(Instant::now()))));

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

            let settings = read_desktop_settings(app.handle());
            let pet_window = pet_builder.build()?;
            if settings.pet_enabled {
                let _ = pet_window.show();
            } else {
                let _ = pet_window.hide();
            }
            let _ = pet_window.unminimize();
            let character_json = serde_json::to_string(&settings.pet_character)
                .unwrap_or_else(|_| "\"robot\"".to_string());
            let _ = pet_window.eval(format!(
                "window.__DSH_SET_PET_CHARACTER__?.({character_json}); window.__DSH_SET_PET_SIZE__?.({});",
                settings.pet_size.clamp(60, 140)
            ));

            if let Some(saved) = read_pet_position(app.handle()) {
                if let Ok(Some(monitor)) = app.monitor_from_point(saved.x as f64, saved.y as f64) {
                    let size = monitor.size();
                    let pet_size = pet_window.inner_size().unwrap_or_default();
                    let x = saved.x.clamp(0, (size.width as i32 - pet_size.width as i32).max(0));
                    let y = saved.y.clamp(0, (size.height as i32 - pet_size.height as i32).max(0));
                    let _ = pet_window.set_position(tauri::PhysicalPosition::new(x, y));
                }
            }

            // 5. ChatGPT-style tray menu: recent chats, companion open/hide toggle, primary actions, quit.
            let recent_empty = MenuItem::with_id(app, "recent-empty", "暂无最近会话", false, None::<&str>)?;
            let recent = Submenu::with_id_and_items(app, "recent", "最近会话", true, &[&recent_empty])?;
            let show = MenuItem::with_id(app, "show", "打开 DSH Desktop", true, None::<&str>)?;
            let pet_toggle = MenuItem::with_id(app, "pet-toggle", "隐藏宠物", true, None::<&str>)?;
            let pet_settings = MenuItem::with_id(app, "pet-settings", "宠物设置...", true, None::<&str>)?;
            let new_chat = MenuItem::with_id(app, "new-chat", "新建会话", true, None::<&str>)?;
            let check_update = MenuItem::with_id(app, "check-update", "检查更新...", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let separator_top = PredefinedMenuItem::separator(app)?;
            let separator_bottom = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[
                    &recent,
                    &separator_top,
                    &show,
                    &pet_toggle,
                    &pet_settings,
                    &new_chat,
                    &check_update,
                    &separator_bottom,
                    &quit_item,
                ],
            )?;
            app.manage(RecentMenu(recent));
            app.manage(PetToggleItem(pet_toggle));
            app.manage(UpdateMenuItem(check_update));

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
                    "pet-toggle" => {
                        if let Some(pet_window) = app.get_webview_window("pet") {
                            let visible = pet_window.is_visible().unwrap_or(false);
                            if visible {
                                let _ = pet_window.hide();
                            } else {
                                let _ = pet_window.show();
                                let _ = pet_window.set_focus();
                            }
                            sync_pet_toggle_label(app);
                        }
                    }
                    "pet-settings" => {
                        if let Some(window) = app.get_webview_window("pet-settings") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        } else if let Ok(window) = tauri::WebviewWindowBuilder::new(
                            app,
                            "pet-settings",
                            WebviewUrl::App("pet-settings.html".into()),
                        )
                        .title("DSH Desktop 宠物设置")
                        .inner_size(460.0, 520.0)
                        .resizable(false)
                        .center()
                        .build()
                        {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "new-chat" => {
                        restore_main_window(app, true);
                    }
                    "check-update" => {
                        if let Some(item) = app.try_state::<UpdateMenuItem>() {
                            let _ = item.0.set_enabled(false);
                            let _ = item.0.set_text("正在检查更新...");
                        }
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let result = check_for_updates(app.clone()).await;
                            if let Some(item) = app.try_state::<UpdateMenuItem>() {
                                let _ = item.0.set_text("检查更新...");
                                let _ = item.0.set_enabled(true);
                            }
                            match result {
                                Ok(false) => {
                                    app.dialog()
                                        .message("当前已是最新版本。")
                                        .kind(MessageDialogKind::Info)
                                        .title("DSH Desktop 更新")
                                        .show(|_| {});
                                }
                                Err(error) => {
                                    eprintln!("更新检查详情: {error}");
                                    app.dialog()
                                        .message(error)
                                        .kind(MessageDialogKind::Info)
                                        .title("DSH Desktop 更新")
                                        .show(|_| {});
                                }
                                Ok(true) => {}
                            }
                        });
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

            sync_pet_toggle_label(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(position) if window.label() == "pet" => {
                let app = window.app_handle();
                let now = Instant::now();
                let should_write = app
                    .try_state::<PetPositionSaver>()
                    .map(|saver| {
                        saver
                            .0
                            .lock()
                            .map(|last| {
                                last.map_or(true, |last| {
                                    now.duration_since(last) > Duration::from_millis(500)
                                })
                            })
                            .unwrap_or(true)
                    })
                    .unwrap_or(true);
                if should_write {
                    if let Some(saver) = app.try_state::<PetPositionSaver>() {
                        if let Ok(mut last) = saver.0.lock() {
                            *last = Some(now);
                        }
                    }
                    let payload = SavedPetPosition {
                        x: position.x,
                        y: position.y,
                    };
                    if let (Ok(file), Ok(serialized)) =
                        (pet_position_file(app), serde_json::to_string(&payload))
                    {
                        let _ = std::fs::write(file, serialized);
                    }
                }
            }
            WindowEvent::CloseRequested { api, .. } if window.label() == "pet" => {
                api.prevent_close();
                let _ = window.hide();
                sync_pet_toggle_label(window.app_handle());
            }
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running DeepSeek Harness Desktop");
}
