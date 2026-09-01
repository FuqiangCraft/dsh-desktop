//! Native process boundary for DeepSeek Harness Desktop.
//!
//! Cordis and its JavaScript plugin ecosystem deliberately remain in the Node
//! sidecar. This crate owns process supervision and the versioned wire
//! protocol, so a Tauri shell can be added without coupling native UI code to
//! the DSH runtime implementation.

pub mod protocol;
pub mod settings;
pub mod supervisor;
