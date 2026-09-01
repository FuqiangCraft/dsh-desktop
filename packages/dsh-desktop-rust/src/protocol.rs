use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u16 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SidecarEvent {
    Ready {
        protocol: u16,
        origin: String,
        port: u16,
        generation: String,
    },
    Error {
        protocol: u16,
        message: String,
    },
    Stopped {
        protocol: u16,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HostCommand {
    Shutdown { protocol: u16 },
    Ping { protocol: u16 },
}

impl HostCommand {
    pub fn shutdown() -> Self {
        Self::Shutdown {
            protocol: PROTOCOL_VERSION,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ready_handshake() {
        let event: SidecarEvent = serde_json::from_str(
            r#"{"type":"ready","protocol":1,"origin":"http://127.0.0.1:3080","port":3080,"generation":"abc"}"#,
        )
        .unwrap();
        assert!(matches!(event, SidecarEvent::Ready { port: 3080, .. }));
    }
}
