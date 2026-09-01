fn main() {
    #[cfg(feature = "tauri-shell")]
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_desktop_settings",
            "save_desktop_settings",
            "window_control",
            "notify",
            "sync_recent_sessions",
            "update_pet_state",
            "get_pet_resource_path",
            "open_pet_resource_folder",
            "list_pet_resources",
            "read_pet_resource",
            "get_update_state",
            "check_for_updates",
            "install_update",
            "open_profile_dir",
            "retry_boot",
            "reset_profile",
            "open_application_menu",
            "select_workspace_folder",
            "get_current_workspace",
            "set_current_workspace",
            "list_recent_workspaces",
        ]),
    ))
    .expect("failed to build Tauri command manifest")
}
