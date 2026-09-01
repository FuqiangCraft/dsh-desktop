use std::{env, sync::Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

const DISABLED_MESSAGE: &str = "自动更新尚未配置；需要正式的 HTTPS 更新端点和签名公钥。";
const DEFAULT_ENDPOINT: &str =
    "https://github.com/FuqiangCraft/dsh-desktop/releases/latest/download/latest.json";
const DEFAULT_PUBLIC_KEY: &str = include_str!("../updater.pub");

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateState {
    phase: String,
    current_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    available_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

struct PendingUpdate {
    update: Update,
    bytes: Vec<u8>,
}

pub struct UpdateManager {
    state: Mutex<DesktopUpdateState>,
    pending: Mutex<Option<PendingUpdate>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct UpdateConfiguration {
    endpoint: String,
    public_key: String,
}

impl UpdateConfiguration {
    fn load() -> Result<Option<Self>, String> {
        let endpoint =
            read_configuration("DSH_UPDATER_ENDPOINT", option_env!("DSH_UPDATER_ENDPOINT"))
                .or_else(|| Some(DEFAULT_ENDPOINT.to_owned()));
        let public_key =
            read_configuration("DSH_UPDATER_PUBKEY", option_env!("DSH_UPDATER_PUBKEY"))
                .or_else(|| Some(DEFAULT_PUBLIC_KEY.trim().to_owned()));
        match (endpoint, public_key) {
            (None, None) => Ok(None),
            (Some(endpoint), Some(public_key)) => {
                let parsed = endpoint
                    .parse::<tauri::Url>()
                    .map_err(|_| "更新端点不是有效 URL".to_owned())?;
                if parsed.scheme() != "https" {
                    return Err("生产更新端点必须使用 HTTPS".to_owned());
                }
                Ok(Some(Self {
                    endpoint,
                    public_key,
                }))
            }
            _ => Err("更新端点和签名公钥必须同时配置".to_owned()),
        }
    }
}

fn read_configuration(name: &str, compiled: Option<&'static str>) -> Option<String> {
    let value = if cfg!(debug_assertions) {
        env::var(name).ok().or_else(|| compiled.map(str::to_owned))
    } else {
        // The release trust root must be immutable. Runtime environment
        // overrides are deliberately limited to debug builds.
        compiled.map(str::to_owned)
    };
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

impl UpdateManager {
    pub fn new(current_version: String) -> Self {
        Self {
            state: Mutex::new(DesktopUpdateState {
                phase: "idle".to_owned(),
                current_version,
                available_version: None,
                percent: None,
                message: UpdateConfiguration::load()
                    .ok()
                    .flatten()
                    .is_none()
                    .then(|| DISABLED_MESSAGE.to_owned()),
            }),
            pending: Mutex::new(None),
        }
    }

    pub fn get(&self) -> DesktopUpdateState {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn publish(&self, app: &AppHandle, patch: impl FnOnce(&mut DesktopUpdateState)) {
        let snapshot = {
            let mut state = self
                .state
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            patch(&mut state);
            state.clone()
        };
        if let Some(window) = app.get_webview_window("dsh") {
            if let Ok(serialized) = serde_json::to_string(&snapshot) {
                let _ = window.eval(format!("window.__DSH_RUST_UPDATE_STATE__?.({serialized})"));
            }
        }
    }

    fn fail(&self, app: &AppHandle, error: impl ToString) -> DesktopUpdateState {
        let message = friendly_error(error.to_string());
        self.publish(app, |state| {
            state.phase = "error".to_owned();
            state.percent = None;
            state.message = Some(message);
        });
        self.get()
    }
}

#[tauri::command]
pub fn get_update_state(manager: tauri::State<'_, UpdateManager>) -> DesktopUpdateState {
    manager.get()
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<DesktopUpdateState, String> {
    let manager = app.state::<UpdateManager>();
    if matches!(manager.get().phase.as_str(), "checking" | "downloading") {
        return Ok(manager.get());
    }
    let configuration = match UpdateConfiguration::load() {
        Ok(Some(configuration)) => configuration,
        Ok(None) => return Ok(manager.fail(&app, DISABLED_MESSAGE)),
        Err(error) => return Ok(manager.fail(&app, error)),
    };
    let endpoint = match configuration.endpoint.parse::<tauri::Url>() {
        Ok(endpoint) => endpoint,
        Err(error) => return Ok(manager.fail(&app, error)),
    };

    manager.publish(&app, |state| {
        state.phase = "checking".to_owned();
        state.available_version = None;
        state.percent = None;
        state.message = Some("正在检查更新…".to_owned());
    });
    let updater = match app
        .updater_builder()
        .endpoints(vec![endpoint])
        .and_then(|builder| builder.pubkey(configuration.public_key).build())
    {
        Ok(updater) => updater,
        Err(error) => return Ok(manager.fail(&app, error)),
    };
    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            manager.publish(&app, |state| {
                state.phase = "up-to-date".to_owned();
                state.message = Some("当前已是最新版本".to_owned());
            });
            return Ok(manager.get());
        }
        Err(error) => return Ok(manager.fail(&app, error)),
    };

    let version = update.version.clone();
    manager.publish(&app, |state| {
        state.phase = "available".to_owned();
        state.available_version = Some(version.clone());
        state.message = Some(format!("发现新版本 {version}"));
    });
    manager.publish(&app, |state| {
        state.phase = "downloading".to_owned();
        state.percent = Some(0);
        state.message = Some("正在下载 0%".to_owned());
    });

    let mut downloaded = 0_u64;
    let bytes = match update
        .download(
            |chunk, total| {
                downloaded = downloaded.saturating_add(chunk as u64);
                let percent = total
                    .filter(|total| *total > 0)
                    .map(|total| ((downloaded.saturating_mul(100) / total).min(100)) as u8);
                manager.publish(&app, |state| {
                    state.percent = percent;
                    state.message = percent.map(|value| format!("正在下载 {value}%"));
                });
            },
            || {},
        )
        .await
    {
        Ok(bytes) => bytes,
        Err(error) => return Ok(manager.fail(&app, error)),
    };

    *manager
        .pending
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(PendingUpdate { update, bytes });
    manager.publish(&app, |state| {
        state.phase = "downloaded".to_owned();
        state.percent = Some(100);
        state.message = Some(format!("版本 {version} 已下载"));
    });
    Ok(manager.get())
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<bool, String> {
    let manager = app.state::<UpdateManager>();
    let pending = manager
        .pending
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .take();
    let Some(pending) = pending else {
        return Ok(false);
    };
    pending
        .update
        .install(&pending.bytes)
        .map_err(|error| error.to_string())?;
    app.request_restart();
    Ok(true)
}

fn friendly_error(raw: String) -> String {
    let lower = raw.to_ascii_lowercase();
    if lower.contains("network")
        || lower.contains("timed out")
        || lower.contains("dns")
        || lower.contains("connect")
    {
        "无法连接更新服务器，请检查网络后重试。".to_owned()
    } else if lower.contains("404") || lower.contains("not found") {
        "GitHub Releases 尚无 Tauri 更新清单；发布首个签名版本后即可检查。".to_owned()
    } else if lower.contains("signature") || lower.contains("public key") {
        "更新签名验证失败，已拒绝安装。".to_owned()
    } else {
        raw.lines()
            .next()
            .filter(|line| !line.is_empty())
            .unwrap_or("检查更新失败")
            .to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::{DEFAULT_ENDPOINT, DEFAULT_PUBLIC_KEY, UpdateConfiguration, friendly_error};

    #[test]
    fn ships_with_github_release_update_configuration() {
        let configuration = UpdateConfiguration::load()
            .expect("default updater configuration should be valid")
            .expect("default updater configuration should be present");

        assert_eq!(configuration.endpoint, DEFAULT_ENDPOINT);
        assert_eq!(configuration.public_key, DEFAULT_PUBLIC_KEY.trim());
        assert!(
            configuration
                .endpoint
                .ends_with("/releases/latest/download/latest.json")
        );
        assert!(!configuration.public_key.is_empty());
    }

    #[test]
    fn hides_network_transport_details() {
        assert_eq!(
            friendly_error("network connection timed out".to_owned()),
            "无法连接更新服务器，请检查网络后重试。"
        );
    }

    #[test]
    fn signature_errors_are_explicit() {
        assert_eq!(
            friendly_error("signature verification failed".to_owned()),
            "更新签名验证失败，已拒绝安装。"
        );
    }

    #[test]
    fn missing_first_release_manifest_is_explicit() {
        assert_eq!(
            friendly_error("HTTP status 404 Not Found".to_owned()),
            "GitHub Releases 尚无 Tauri 更新清单；发布首个签名版本后即可检查。"
        );
    }
}
