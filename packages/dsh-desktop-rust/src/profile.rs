use std::{env, fs, io, path::PathBuf};

const MANIFEST: &str = r#"{
  "name": "dsh-desktop-profile",
  "private": true,
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@mixian/dsh-desktop-plugin"
      ]
    }
  }
}
"#;

const PATCH: &str = "- id: directory-picker\n  disabled: true\n- insert:\n    - id: directory-picker-browse\n      name: '@deepseek-ai/dsh-host-directory-picker-browse'\n    - id: ui-directory-picker-browse\n      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'\n";
const ROOT_CONFIG: &str = "[]\n";

#[derive(Debug, Clone)]
pub struct DesktopProfile {
    directory: PathBuf,
}

impl DesktopProfile {
    pub fn platform_default() -> Self {
        let home = env::var_os("DSH_DESKTOP_HOME")
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|path| path.join(".dsh-desktop")))
            .unwrap_or_else(|| PathBuf::from(".dsh-desktop"));
        Self::new(home.join("profiles").join("desktop"))
    }

    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    pub fn directory(&self) -> &PathBuf {
        &self.directory
    }

    pub fn reset(&self) -> io::Result<()> {
        fs::create_dir_all(&self.directory)?;
        fs::write(self.directory.join("package.json"), MANIFEST)?;
        fs::write(self.directory.join("cordis.patch.yml"), PATCH)?;
        fs::write(self.directory.join("cordis.yml"), ROOT_CONFIG)?;
        fs::write(
            self.directory.join(".checkpoint.json"),
            serde_json::to_vec_pretty(&serde_json::json!({
                "manifest": MANIFEST,
                "patch": PATCH,
            }))?,
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{DesktopProfile, MANIFEST, PATCH};

    #[test]
    fn reset_recreates_only_the_canonical_profile_files() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("dsh-profile-test-{nonce}"));
        let profile = DesktopProfile::new(directory.clone());
        profile.reset().unwrap();

        assert_eq!(
            fs::read_to_string(directory.join("package.json")).unwrap(),
            MANIFEST
        );
        assert_eq!(
            fs::read_to_string(directory.join("cordis.patch.yml")).unwrap(),
            PATCH
        );
        assert_eq!(
            fs::read_to_string(directory.join("cordis.yml")).unwrap(),
            "[]\n"
        );
        assert!(directory.join(".checkpoint.json").is_file());

        fs::remove_dir_all(directory).unwrap();
    }
}
