# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Privacy and Consent Model

DeepSeek Harness Desktop is designed with strict operator privacy principles:

1. **Screen Capture Consent**: The `screen_capture` tool is disabled by default. The host operator must explicitly enable it in the profile's `cordis.patch.yml` via `screenCapture: true`.
2. **Transparent Execution**: Even when enabled, screen capture only executes when explicitly invoked by the model in response to user intent, and the captured image is always committed back into the session as a durable attachment so the operator can inspect exactly what was captured.
3. **No Hidden Telemetry**: The plugin transmits no telemetry, logs, or analytics to external servers. All operations run strictly on the local host and client runtime.

## Reporting a Vulnerability

If you discover a security vulnerability within DeepSeek Harness Desktop, please do NOT create a public issue.

Instead, please send an email to the repository maintainers or open a confidential security advisory on GitHub:

- Email: `fuqiangcraft@gmail.com`
- GitHub Advisory: [Submit a private report](https://github.com/FuqiangCraft/dsh-desktop/security/advisories/new)

We will respond within 48 hours and work with you to resolve the issue before public disclosure.
