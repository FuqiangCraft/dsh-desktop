# Contributing to DeepSeek Harness Desktop

Thank you for your interest in contributing to DeepSeek Harness Desktop!

## Development Setup

This repository is managed with `pnpm` workspaces:

```sh
# Clone the repository
git clone https://github.com/FuqiangCraft/dsh-desktop.git
cd dsh-desktop

# Install workspace dependencies
pnpm install

# Run the complete test and build verification suite
pnpm run check
```

## Project Structure

- `packages/dsh-desktop-plugin`: The dual-sided Cordis plugin for DSH.
  - `src/index.ts`: Host plugin entry (Cordis service injection, config schema).
  - `src/tool-screen-capture.ts`: Model-facing screenshot tool with explicit consent.
  - `src/client/index.ts`: Client UI entry for DSH Web UI.
  - `src/client/notifier.ts`: Real-time desktop notifications for pending interactions.
  - `src/client/MultiAgentCanvas.tsx`: Multi-agent tiling status grid in `conversation.view`.
  - `src/client/locales.ts`: Full bilingual (ZH / EN) dictionaries.
- `packages/dsh-desktop-electron`: Electron desktop shell embedding DSH.
- `stubs/`: Workspace type stubs for unpublished internal DSH packages.
- `scripts/verify-bundle.mjs`: Automated bundle integrity and manifest validator.

## Scripts

- `pnpm run lint`: Lint code with OxLint.
- `pnpm run typecheck`: Typecheck all TypeScript files.
- `pnpm run test`: Run the full test suite using native `node:test`.
- `pnpm run verify:bundle`: Verify plugin bundle assets, exports, and cordis patch formats.
- `pnpm run check`: Run lint, typecheck, test, build, and verify:bundle in sequence.

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features or capabilities
- `fix:` Bug fixes
- `test:` Adding or updating tests
- `docs:` Documentation changes
- `chore:` Tooling, CI, or dependency updates
- `refactor:` Code refactoring without behavior changes

## Pull Request Checklist

1. Make sure `pnpm run check` passes completely without warnings or errors.
2. Ensure any new features include matching unit tests in `test/`.
3. If modifying UI copy, ensure both Chinese (`zh`) and English (`en`) in `locales.ts` are updated with full key parity.
