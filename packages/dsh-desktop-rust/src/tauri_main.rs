#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    path::PathBuf,
    sync::{Mutex, MutexGuard},
    time::Duration,
};

use dsh_desktop_host::{
    settings::{DesktopSettings, DesktopSettingsPatch, DesktopSettingsStore, PetPosition},
    supervisor::HostSupervisor,
};
use serde::Deserialize;
use tauri::{
    LogicalPosition, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
    menu::{ContextMenu, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

mod updater;
use updater::{UpdateManager, check_for_updates, get_update_state, install_update};
mod profile;
use profile::DesktopProfile;
mod application_menu;
use application_menu::build_popup;

struct SidecarState(Mutex<Option<HostSupervisor>>);
struct RecentSessions(Mutex<Vec<RecentSession>>);
struct ZoomState(Mutex<f64>);

const PROJECT_URL: &str = "https://github.com/FuqiangCraft/dsh-desktop";

#[derive(Debug, Clone, Deserialize)]
struct RecentSession {
    id: String,
    title: String,
}

#[derive(Debug, Deserialize)]
struct NotificationPayload {
    id: String,
    title: String,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    label: String,
}

#[tauri::command]
fn get_desktop_settings(store: tauri::State<'_, DesktopSettingsStore>) -> DesktopSettings {
    store.get()
}

#[tauri::command]
fn save_desktop_settings(
    app: tauri::AppHandle,
    store: tauri::State<'_, DesktopSettingsStore>,
    patch: DesktopSettingsPatch,
) -> Result<DesktopSettings, String> {
    let settings = store.save(patch)?;
    if let Err(error) = sync_pet_window(&app, &settings) {
        eprintln!("failed to synchronize pet window: {error}");
    }
    Ok(settings)
}

#[tauri::command]
fn window_control(window: tauri::WebviewWindow, action: String) -> Result<(), String> {
    match action.as_str() {
        "minimize" => window.minimize(),
        "maximize" => {
            if window.is_maximized().map_err(|error| error.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => window.close(),
        "quit" => {
            window.app_handle().exit(0);
            return Ok(());
        }
        _ => return Err(format!("unsupported window action: {action}")),
    }
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn notify(app: tauri::AppHandle, payload: NotificationPayload) -> Result<(), String> {
    if payload.id.is_empty() || payload.id.len() > 200 {
        return Err("invalid notification session id".to_owned());
    }
    let title = truncate(&payload.title, 160);
    if title.is_empty() {
        return Err("notification title is required".to_owned());
    }
    let body = if payload.label.is_empty() {
        truncate(&payload.kind, 500)
    } else {
        truncate(&payload.label, 500)
    };
    app.notification()
        .builder()
        .title(format!("DeepSeek Harness · {title}"))
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn sync_recent_sessions(
    app: tauri::AppHandle,
    state: tauri::State<'_, RecentSessions>,
    sessions: Vec<RecentSession>,
) -> Result<(), String> {
    let sanitized = sessions
        .into_iter()
        .filter(|session| !session.id.is_empty() && !session.title.is_empty())
        .take(5)
        .map(|session| RecentSession {
            id: truncate(&session.id, 200),
            title: truncate(&session.title, 80),
        })
        .collect::<Vec<_>>();
    *state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = sanitized.clone();
    let menu = build_tray_menu(&app, &sanitized).map_err(|error| error.to_string())?;
    app.tray_by_id("dsh-tray")
        .ok_or_else(|| "DSH tray is unavailable".to_owned())?
        .set_menu(Some(menu))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn update_pet_state(app: tauri::AppHandle, state: String, text: String) -> Result<(), String> {
    if !matches!(
        state.as_str(),
        "idle" | "thinking" | "working" | "alert" | "success"
    ) {
        return Err("invalid pet state".to_owned());
    }
    if let Some(window) = app.get_webview_window("pet") {
        let state = serde_json::to_string(&state).map_err(|error| error.to_string())?;
        let text =
            serde_json::to_string(&truncate(&text, 300)).map_err(|error| error.to_string())?;
        window
            .eval(format!(
                "window.__DSH_RUST_SET_PET_STATE__?.({state}, {text})"
            ))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_pet_resource_path(store: tauri::State<'_, DesktopSettingsStore>) -> String {
    store.pets_dir().to_string_lossy().into_owned()
}

#[tauri::command]
fn open_pet_resource_folder(
    app: tauri::AppHandle,
    store: tauri::State<'_, DesktopSettingsStore>,
) -> Result<(), String> {
    app.opener()
        .open_path(store.pets_dir().to_string_lossy(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_pet_resources(store: tauri::State<'_, DesktopSettingsStore>) -> Vec<String> {
    store.list_pet_resources()
}

#[tauri::command]
fn read_pet_resource(
    store: tauri::State<'_, DesktopSettingsStore>,
    name: String,
) -> Option<String> {
    store.read_pet_resource(&name)
}

#[tauri::command]
fn open_profile_dir(
    app: tauri::AppHandle,
    profile: tauri::State<'_, DesktopProfile>,
) -> Result<(), String> {
    std::fs::create_dir_all(profile.directory()).map_err(|error| error.to_string())?;
    app.opener()
        .open_path(profile.directory().to_string_lossy(), None::<&str>)
        .map_err(|error| error.to_string())
}

fn restart_after_response(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(150));
        app.request_restart();
    });
}

#[tauri::command]
fn retry_boot(app: tauri::AppHandle) -> bool {
    restart_after_response(app);
    true
}

#[tauri::command]
fn reset_profile(
    app: tauri::AppHandle,
    profile: tauri::State<'_, DesktopProfile>,
) -> Result<bool, String> {
    profile.reset().map_err(|error| error.to_string())?;
    restart_after_response(app);
    Ok(true)
}

#[tauri::command]
fn open_application_menu(
    window: tauri::WebviewWindow,
    label: String,
    x: i32,
    y: i32,
) -> Result<bool, String> {
    let Some(menu) = build_popup(window.app_handle(), &label).map_err(|error| error.to_string())?
    else {
        return Ok(false);
    };
    menu.popup_at(
        window.as_ref().window(),
        LogicalPosition::new(f64::from(x.clamp(0, 10_000)), f64::from(y.clamp(0, 10_000))),
    )
    .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
fn select_workspace_folder(
    app: tauri::AppHandle,
    store: tauri::State<'_, DesktopSettingsStore>,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_title("选择工作空间文件夹");
    if let Some(last) = store.current_workspace() {
        if std::path::Path::new(&last).exists() {
            dialog = dialog.set_directory(last);
        }
    }
    let selected = dialog.pick_folder();
    if let Some(path) = selected {
        let path_str = path.to_string_lossy().into_owned();
        let _ = store.record_workspace(&path_str);
        if let Some(window) = app.get_webview_window("dsh") {
            if let Ok(encoded) = serde_json::to_string(&path_str) {
                let _ = window.eval(format!("window.__DSH_DESKTOP_SET_WORKSPACE__?.({encoded})"));
            }
        }
        return Ok(Some(path_str));
    }
    Ok(None)
}

#[tauri::command]
fn get_current_workspace(store: tauri::State<'_, DesktopSettingsStore>) -> Option<String> {
    store.current_workspace()
}

#[tauri::command]
fn set_current_workspace(
    app: tauri::AppHandle,
    store: tauri::State<'_, DesktopSettingsStore>,
    path: String,
) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("workspace path cannot be empty".to_owned());
    }
    store.record_workspace(trimmed)?;
    if let Some(window) = app.get_webview_window("dsh") {
        if let Ok(encoded) = serde_json::to_string(trimmed) {
            let _ = window.eval(format!("window.__DSH_DESKTOP_SET_WORKSPACE__?.({encoded})"));
        }
    }
    Ok(trimmed.to_owned())
}

#[tauri::command]
fn list_recent_workspaces(store: tauri::State<'_, DesktopSettingsStore>) -> Vec<String> {
    store.list_recent_workspaces()
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn state_lock(state: &SidecarState) -> MutexGuard<'_, Option<HostSupervisor>> {
    state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("dsh") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn handle_application_menu_event(app: &tauri::AppHandle, event: MenuEvent) {
    let Some(window) = app.get_webview_window("dsh") else {
        return;
    };
    match event.id().as_ref() {
        "app:new-chat" => {
            let _ = window.eval("window.__DSH_DESKTOP_NEW_CHAT__?.()");
        }
        "app:open-workspace" => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let store = app.state::<DesktopSettingsStore>();
                let _ = select_workspace_folder(app.clone(), store);
            });
        }
        "app:reload" => {
            let _ = window.reload();
        }
        "app:zoom-reset" | "app:zoom-in" | "app:zoom-out" => {
            let state = app.state::<ZoomState>();
            let mut zoom = state
                .0
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            *zoom = match event.id().as_ref() {
                "app:zoom-reset" => 1.0,
                "app:zoom-in" => (*zoom + 0.1).min(5.0),
                _ => (*zoom - 0.1).max(0.2),
            };
            let _ = window.set_zoom(*zoom);
        }
        "app:show" => show_main_window(app),
        "app:project-home" => {
            let _ = app.opener().open_url(PROJECT_URL, None::<&str>);
        }
        "app:check-updates" => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = check_for_updates(app).await;
            });
        }
        _ => {}
    }
}

fn open_session(app: &tauri::AppHandle, id: &str) {
    show_main_window(app);
    if let Some(window) = app.get_webview_window("dsh") {
        if let Ok(encoded) = serde_json::to_string(id) {
            let _ = window.eval(format!("window.__DSH_DESKTOP_OPEN_SESSION__?.({encoded})"));
        }
    }
}

fn sync_pet_window(app: &tauri::AppHandle, settings: &DesktopSettings) -> tauri::Result<()> {
    if !settings.pet_enabled {
        if let Some(window) = app.get_webview_window("pet") {
            window.hide()?;
        }
        return Ok(());
    }

    let window = if let Some(window) = app.get_webview_window("pet") {
        window
    } else {
        let character = serde_json::to_string(&settings.pet_character)?;
        let initialization = format!(
            "{}\nwindow.__DSH_RUST_SET_PET_CHARACTER__({character});window.__DSH_RUST_SET_PET_SIZE__({});",
            include_str!("pet_bridge.js"),
            settings.pet_size,
        );
        let mut builder = WebviewWindowBuilder::new(app, "pet", WebviewUrl::App("pet.html".into()))
            .title("")
            .inner_size(160.0, 160.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .visible(false)
            .initialization_script(initialization);
        if let Some(position) = app.state::<DesktopSettingsStore>().pet_position() {
            builder = builder.position(f64::from(position.x), f64::from(position.y));
        }
        builder.build()?
    };

    let character = serde_json::to_string(&settings.pet_character)?;
    window.eval(format!("window.__DSH_RUST_SET_PET_CHARACTER__?.({character});window.__DSH_RUST_SET_PET_SIZE__?.({})", settings.pet_size))?;
    window.show()?;
    Ok(())
}

fn build_tray_menu(
    app: &tauri::AppHandle,
    sessions: &[RecentSession],
) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    menu.append(&MenuItem::with_id(
        app,
        "open",
        "Open DSH Desktop",
        true,
        None::<&str>,
    )?)?;
    if !sessions.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
        for (index, session) in sessions.iter().enumerate() {
            menu.append(&MenuItem::with_id(
                app,
                format!("session:{index}"),
                &session.title,
                true,
                None::<&str>,
            )?)?;
        }
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;
    Ok(menu)
}

fn create_tray(app: &tauri::App, sessions: &[RecentSession]) -> tauri::Result<()> {
    let menu = build_tray_menu(app.handle(), sessions)?;
    let mut builder = TrayIconBuilder::with_id("dsh-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("DSH Desktop")
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == "open" {
                show_main_window(app);
            } else if id == "quit" {
                app.exit(0);
            } else if let Some(index) = id
                .strip_prefix("session:")
                .and_then(|raw| raw.parse::<usize>().ok())
            {
                if let Some(state) = app.try_state::<RecentSessions>() {
                    let session = state
                        .0
                        .lock()
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .get(index)
                        .cloned();
                    if let Some(session) = session {
                        open_session(app, &session.id);
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

fn runtime_paths(app: &tauri::App) -> tauri::Result<(PathBuf, PathBuf)> {
    if cfg!(debug_assertions) {
        let node_override = env::var_os("DSH_NODE_BINARY").map(PathBuf::from);
        let sidecar_override = env::var_os("DSH_SIDECAR_ENTRY").map(PathBuf::from);
        return Ok((
            node_override.unwrap_or_else(|| PathBuf::from("node")),
            sidecar_override
                .unwrap_or_else(|| PathBuf::from("packages/dsh-desktop-sidecar/dist/main.mjs")),
        ));
    }
    let resource_dir = app.path().resource_dir()?;
    #[cfg(windows)]
    let resource_dir = {
        let display = resource_dir.to_string_lossy();
        PathBuf::from(display.strip_prefix(r"\\?\").unwrap_or(&display))
    };
    let runtime = resource_dir.join("runtime");
    let node_name = if cfg!(windows) {
        "dsh-node.exe"
    } else {
        "dsh-node"
    };
    Ok((
        runtime.join("bin").join(node_name),
        runtime.join("sidecar.mjs"),
    ))
}

fn recovery_initialization(error: &str) -> String {
    let error = serde_json::to_string(&truncate(error, 2_000))
        .unwrap_or_else(|_| "\"Unknown startup error\"".to_owned());
    format!(
        "{}\nwindow.__DSH_BOOT_ERROR__ = {error};",
        include_str!("bridge.js")
    )
}

#[cfg(test)]
mod recovery_tests {
    use super::recovery_initialization;

    #[test]
    fn startup_error_is_json_encoded_and_bounded() {
        let script = recovery_initialization(&format!("bad ' quote\n{}", "x".repeat(3_000)));
        assert!(script.contains("bad ' quote\\n"));
        assert!(!script.contains(&"x".repeat(2_100)));
        assert!(script.contains("window.__DSH_BOOT_ERROR__"));
    }

    #[test]
    fn main_bridge_installs_the_single_row_titlebar_without_a_product_title() {
        let bridge = include_str!("bridge.js");
        assert!(bridge.contains("dsh-shell-titlebar"));
        assert!(bridge.contains("['文件', '编辑', '视图', '窗口', '帮助']"));
        assert!(bridge.contains(r#"data-window="close""#));
        assert!(!bridge.contains("DSH Desktop"));
    }

    #[test]
    fn workspace_commands_are_registered_and_allowed_for_the_remote_client() {
        let manifest = include_str!("../build.rs");
        let permission = include_str!("../permissions/desktop-bridge.toml");
        for command in [
            "select_workspace_folder",
            "get_current_workspace",
            "set_current_workspace",
            "list_recent_workspaces",
        ] {
            assert!(
                manifest.contains(&format!("\"{command}\"")),
                "{command} missing from Tauri command manifest"
            );
            assert!(
                permission.contains(&format!("\"{command}\"")),
                "{command} missing from desktop bridge permission"
            );
        }
    }
}

fn create_recovery_window(app: &tauri::App, error: &str) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "dsh", WebviewUrl::App("boot-error.html".into()))
        .title("DSH Desktop · 启动恢复")
        .inner_size(820.0, 620.0)
        .min_inner_size(680.0, 520.0)
        .initialization_script(recovery_initialization(error))
        .build()?;
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        // This must remain the first plugin: a secondary process must exit
        // before it can initialize native providers or start a DSH Sidecar.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SidecarState(Mutex::new(None)))
        .manage(DesktopSettingsStore::platform_default())
        .manage(DesktopProfile::platform_default())
        .manage(RecentSessions(Mutex::new(Vec::new())))
        .manage(ZoomState(Mutex::new(1.0)))
        .invoke_handler(tauri::generate_handler![
            get_desktop_settings,
            save_desktop_settings,
            window_control,
            notify,
            sync_recent_sessions,
            update_pet_state,
            get_pet_resource_path,
            open_pet_resource_folder,
            list_pet_resources,
            read_pet_resource,
            get_update_state,
            check_for_updates,
            install_update,
            open_profile_dir,
            retry_boot,
            reset_profile,
            open_application_menu,
            select_workspace_folder,
            get_current_workspace,
            set_current_workspace,
            list_recent_workspaces
        ])
        .setup(|app| {
            app.manage(UpdateManager::new(app.package_info().version.to_string()));
            let (node, sidecar) = runtime_paths(app)?;
            match HostSupervisor::start(&node, &sidecar, Duration::from_secs(30)) {
                Ok((supervisor, ready)) => {
                    let allowed_url: tauri::Url = ready.origin.parse()?;
                    let window_url = allowed_url.clone();
                    WebviewWindowBuilder::new(app, "dsh", WebviewUrl::External(window_url))
                        .title("")
                        .inner_size(1280.0, 860.0)
                        .min_inner_size(960.0, 640.0)
                        .decorations(false)
                        .initialization_script(include_str!("bridge.js"))
                        .on_navigation(move |target| target.origin() == allowed_url.origin())
                        .build()?;
                    *state_lock(app.state::<SidecarState>().inner()) = Some(supervisor);
                }
                Err(error) => {
                    eprintln!("DSH sidecar startup failed: {error}");
                    create_recovery_window(app, &error.to_string())?;
                }
            }
            create_tray(app, &[])?;
            Ok(())
        })
        .on_menu_event(handle_application_menu_event)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            if window.label() == "pet" {
                if let tauri::WindowEvent::Moved(position) = event {
                    let store = window.app_handle().state::<DesktopSettingsStore>();
                    let _ = store.save_pet_position(PetPosition {
                        x: position.x,
                        y: position.y,
                    });
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build DSH Tauri desktop");

    app.run(|handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            if let Some(supervisor) = state_lock(handle.state::<SidecarState>().inner()).take() {
                let _ = supervisor.shutdown(Duration::from_secs(3));
            }
        }
    });
}
