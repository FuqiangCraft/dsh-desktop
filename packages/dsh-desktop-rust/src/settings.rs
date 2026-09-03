use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    pub pet_enabled: bool,
    pub pet_character: String,
    pub pet_size: u16,
    #[serde(default = "default_true")]
    pub pet_always_on_top: bool,
    #[serde(default = "default_opacity")]
    pub pet_opacity: u8,
    #[serde(default)]
    pub pet_click_through: bool,
    #[serde(default = "default_true")]
    pub global_shortcut_enabled: bool,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    #[serde(default = "default_volume")]
    pub sound_volume: u8,
    #[serde(default)]
    pub screen_capture_enabled: bool,
    #[serde(default)]
    pub last_workspace: Option<String>,
    #[serde(default)]
    pub recent_workspaces: Vec<String>,
}

fn default_true() -> bool {
    true
}
fn default_opacity() -> u8 {
    100
}
fn default_volume() -> u8 {
    80
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            pet_enabled: true,
            pet_character: "robot".to_owned(),
            pet_size: 100,
            pet_always_on_top: true,
            pet_opacity: 100,
            pet_click_through: false,
            global_shortcut_enabled: true,
            sound_enabled: true,
            sound_volume: 80,
            screen_capture_enabled: false,
            last_workspace: None,
            recent_workspaces: Vec::new(),
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettingsPatch {
    pub pet_enabled: Option<bool>,
    pub pet_character: Option<String>,
    pub pet_size: Option<u16>,
    pub pet_always_on_top: Option<bool>,
    pub pet_opacity: Option<u8>,
    pub pet_click_through: Option<bool>,
    pub global_shortcut_enabled: Option<bool>,
    pub sound_enabled: Option<bool>,
    pub sound_volume: Option<u8>,
    pub screen_capture_enabled: Option<bool>,
    pub last_workspace: Option<Option<String>>,
    pub recent_workspaces: Option<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PetPosition {
    pub x: i32,
    pub y: i32,
}

pub struct DesktopSettingsStore {
    root: PathBuf,
    file: PathBuf,
    cached: Mutex<Option<DesktopSettings>>,
}

impl DesktopSettingsStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        let root = root.into();
        Self {
            file: root.join("desktop-settings.json"),
            root,
            cached: Mutex::new(None),
        }
    }

    pub fn pets_dir(&self) -> PathBuf {
        let path = self.root.join("pets");
        let _ = fs::create_dir_all(&path);
        path
    }

    pub fn pet_position(&self) -> Option<PetPosition> {
        let raw = fs::read_to_string(self.root.join("pet-position.json")).ok()?;
        serde_json::from_str(&raw).ok()
    }

    pub fn save_pet_position(&self, position: PetPosition) -> Result<(), String> {
        let file = self.root.join("pet-position.json");
        if let Some(parent) = file.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(
            file,
            serde_json::to_vec_pretty(&position).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())
    }

    pub fn list_pet_resources(&self) -> Vec<String> {
        let mut names = Vec::new();
        self.collect_png_names(&self.pets_dir(), &mut names);
        if let Some(home) = dirs::home_dir() {
            self.collect_png_names(&home.join(".dsh").join("pets"), &mut names);
        }
        names.sort();
        names.dedup();
        names.truncate(20);
        names
    }

    pub fn read_pet_resource(&self, name: &str) -> Option<String> {
        if !valid_resource_name(name) {
            return None;
        }
        let mut candidates = vec![self.pets_dir().join(format!("{name}.png"))];
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join(".dsh").join("pets").join(format!("{name}.png")));
        }
        candidates.into_iter().find_map(|file| {
            let metadata = fs::metadata(&file).ok()?;
            if !metadata.is_file() || metadata.len() > 2 * 1024 * 1024 {
                return None;
            }
            let bytes = fs::read(file).ok()?;
            if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                return None;
            }
            Some(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
        })
    }

    fn collect_png_names(&self, directory: &Path, output: &mut Vec<String>) {
        let Ok(entries) = fs::read_dir(directory) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("png"))
            {
                if let Some(name) = path
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .filter(|name| valid_resource_name(name))
                {
                    output.push(name.to_owned());
                }
            }
        }
    }

    pub fn platform_default() -> Self {
        let root = std::env::var_os("DSH_DESKTOP_HOME")
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|home| home.join(".dsh-desktop")))
            .unwrap_or_else(|| PathBuf::from(".dsh-desktop"));
        Self::new(root)
    }

    pub fn get(&self) -> DesktopSettings {
        let mut cached = self.cache();
        if let Some(settings) = cached.as_ref() {
            return settings.clone();
        }
        let settings = fs::read_to_string(&self.file)
            .ok()
            .and_then(|raw| serde_json::from_str::<DesktopSettings>(&raw).ok())
            .map(sanitize)
            .unwrap_or_default();
        *cached = Some(settings.clone());
        settings
    }

    pub fn save(&self, patch: DesktopSettingsPatch) -> Result<DesktopSettings, String> {
        let current = self.get();
        let last_workspace = match patch.last_workspace {
            Some(val) => val,
            None => current.last_workspace,
        };
        let recent_workspaces = match patch.recent_workspaces {
            Some(val) => val,
            None => current.recent_workspaces,
        };
        let updated = sanitize(DesktopSettings {
            pet_enabled: patch.pet_enabled.unwrap_or(current.pet_enabled),
            pet_character: patch.pet_character.unwrap_or(current.pet_character),
            pet_size: patch.pet_size.unwrap_or(current.pet_size),
            pet_always_on_top: patch.pet_always_on_top.unwrap_or(current.pet_always_on_top),
            pet_opacity: patch.pet_opacity.unwrap_or(current.pet_opacity),
            pet_click_through: patch.pet_click_through.unwrap_or(current.pet_click_through),
            global_shortcut_enabled: patch.global_shortcut_enabled.unwrap_or(current.global_shortcut_enabled),
            sound_enabled: patch.sound_enabled.unwrap_or(current.sound_enabled),
            sound_volume: patch.sound_volume.unwrap_or(current.sound_volume),
            screen_capture_enabled: patch.screen_capture_enabled.unwrap_or(current.screen_capture_enabled),
            last_workspace,
            recent_workspaces,
        });
        write_json_atomic(&self.file, &updated).map_err(|error| error.to_string())?;
        *self.cache() = Some(updated.clone());
        Ok(updated)
    }

    pub fn record_workspace(&self, workspace: &str) -> Result<DesktopSettings, String> {
        let trimmed = workspace.trim();
        if trimmed.is_empty() {
            return Err("workspace path cannot be empty".to_owned());
        }
        let current = self.get();
        let mut recent = vec![trimmed.to_owned()];
        for ws in current.recent_workspaces {
            if ws != trimmed {
                recent.push(ws);
            }
        }
        recent.truncate(10);
        self.save(DesktopSettingsPatch {
            last_workspace: Some(Some(trimmed.to_owned())),
            recent_workspaces: Some(recent),
            ..Default::default()
        })
    }

    pub fn list_recent_workspaces(&self) -> Vec<String> {
        self.get().recent_workspaces
    }

    pub fn current_workspace(&self) -> Option<String> {
        self.get().last_workspace
    }

    fn cache(&self) -> MutexGuard<'_, Option<DesktopSettings>> {
        self.cached
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn sanitize(mut settings: DesktopSettings) -> DesktopSettings {
    settings.pet_size = settings.pet_size.clamp(60, 140);
    settings.pet_opacity = settings.pet_opacity.clamp(50, 100);
    settings.sound_volume = settings.sound_volume.min(100);
    if settings.pet_character.len() > 100 || settings.pet_character.is_empty() {
        settings.pet_character = DesktopSettings::default().pet_character;
    }
    if let Some(ref ws) = settings.last_workspace {
        if ws.trim().is_empty() || ws.len() > 1024 {
            settings.last_workspace = None;
        }
    }
    let mut cleaned_recent = Vec::new();
    for ws in settings.recent_workspaces {
        let trimmed = ws.trim();
        if !trimmed.is_empty()
            && trimmed.len() <= 1024
            && !cleaned_recent.iter().any(|r| r == trimmed)
        {
            cleaned_recent.push(trimmed.to_string());
        }
        if cleaned_recent.len() >= 10 {
            break;
        }
    }
    settings.recent_workspaces = cleaned_recent;
    settings
}

fn valid_resource_name(name: &str) -> bool {
    !name.is_empty()
        && name.chars().count() <= 80
        && !name.contains(['/', '\\'])
        && !name.contains("..")
}

fn write_json_atomic(file: &Path, value: &DesktopSettings) -> std::io::Result<()> {
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = file.with_extension(format!("{}.tmp", std::process::id()));
    let mut output = fs::File::create(&temporary)?;
    serde_json::to_writer_pretty(&mut output, value)?;
    output.write_all(b"\n")?;
    output.sync_all()?;
    if file.exists() {
        fs::remove_file(file)?;
    }
    fs::rename(temporary, file)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(name: &str) -> PathBuf {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "dsh-rust-settings-{name}-{}-{nonce}",
            std::process::id(),
        ))
    }

    #[test]
    fn desktop_pet_is_enabled_by_default() {
        assert!(DesktopSettings::default().pet_enabled);
        assert!(
            DesktopSettingsStore::new(test_root("default"))
                .get()
                .pet_enabled
        );
    }

    #[test]
    fn persists_and_clamps_settings() {
        let root = test_root("persistence");
        let store = DesktopSettingsStore::new(&root);
        let saved = store
            .save(DesktopSettingsPatch {
                pet_enabled: Some(true),
                pet_character: Some("cat".to_owned()),
                pet_size: Some(500),
                pet_opacity: Some(20),
                sound_volume: Some(250),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(saved.pet_size, 140);
        assert_eq!(saved.pet_opacity, 50);
        assert_eq!(saved.sound_volume, 100);
        assert_eq!(DesktopSettingsStore::new(&root).get(), saved);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn persists_workspace_and_recent_history() {
        let root = test_root("workspace");
        let store = DesktopSettingsStore::new(&root);
        let s1 = store.record_workspace("D:\\projects\\demo").unwrap();
        assert_eq!(s1.last_workspace.as_deref(), Some("D:\\projects\\demo"));
        assert_eq!(s1.recent_workspaces, vec!["D:\\projects\\demo"]);

        let s2 = store.record_workspace("D:\\projects\\other").unwrap();
        assert_eq!(s2.last_workspace.as_deref(), Some("D:\\projects\\other"));
        assert_eq!(
            s2.recent_workspaces,
            vec!["D:\\projects\\other", "D:\\projects\\demo"]
        );

        // Recording the first one again moves it to top without duplicates
        let s3 = store.record_workspace("D:\\projects\\demo").unwrap();
        assert_eq!(s3.last_workspace.as_deref(), Some("D:\\projects\\demo"));
        assert_eq!(
            s3.recent_workspaces,
            vec!["D:\\projects\\demo", "D:\\projects\\other"]
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn invalid_file_falls_back_to_defaults() {
        let root = test_root("invalid");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("desktop-settings.json"), "not json").unwrap();
        assert_eq!(
            DesktopSettingsStore::new(&root).get(),
            DesktopSettings::default()
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn pet_resources_reject_traversal_and_non_png_content() {
        let root = test_root("pets");
        let store = DesktopSettingsStore::new(&root);
        fs::write(store.pets_dir().join("fake.png"), b"not a png").unwrap();
        assert!(store.list_pet_resources().contains(&"fake".to_owned()));
        assert_eq!(store.read_pet_resource("fake"), None);
        assert_eq!(store.read_pet_resource("../secret"), None);
        let _ = fs::remove_dir_all(root);
    }
}
