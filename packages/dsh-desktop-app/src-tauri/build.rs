fn main() {
    // Declaring an app ACL manifest makes the app's own commands referenceable
    // in capabilities — required so the embedded dsh web UI (a REMOTE origin)
    // can invoke them. Tauri v2 denies all IPC from remote origins unless an
    // explicit capability grants the command with a matching `remote.urls`.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new()
                .commands(&["sync_recent_sessions", "retry_spawn_dsh"]),
        ),
    )
    .expect("failed to run tauri-build")
}
