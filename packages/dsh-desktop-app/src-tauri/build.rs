fn main() {
    // Declaring an app ACL manifest makes the app's own commands referenceable
    // in capabilities — required so the embedded dsh web UI (a REMOTE origin)
    // can invoke them. Tauri v2 denies all IPC from remote origins unless an
    // explicit capability grants the command with a matching `remote.urls`.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "sync_recent_sessions",
                "retry_spawn_dsh",
                "sync_desktop_settings",
                "get_desktop_settings",
                "get_pet_resource_path",
                "open_pet_resource_folder",
                "list_pet_resources",
                "read_pet_resource",
                "update_pet_state",
                "start_dragging_pet",
                "check_for_updates",
            ]),
        ),
    )
    .expect("failed to run tauri-build")
}
