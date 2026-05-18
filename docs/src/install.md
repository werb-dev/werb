# Installation

Werb runs three ways from the same codebase. Pick whichever fits.

## Web app

Open <https://werb-dev.github.io/werb/> in any modern browser. The page is a Progressive Web App — your browser will offer an "Install" button (or "Add to Home Screen" on iOS/iPadOS) that turns it into a standalone app with its own dock icon. All data stays in the browser's [origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system); nothing leaves the device unless you opt into [GitHub sync](./sync.md).

Tested against iPad Air 2 / iOS 15.8.4 for the older Safari corner cases — the PWA path is the only realistic choice on iPad today.

## Desktop app

Download the bundle for your platform from the [latest release](https://github.com/werb-dev/werb/releases/latest):

| Platform | Asset |
|---|---|
| macOS (Apple Silicon) | `Werb_*_aarch64.dmg` |
| Linux | `werb_*_amd64.deb` or `werb_*_amd64.AppImage` |
| Windows | `Werb_*_x64-setup.exe` or `Werb_*_x64_en-US.msi` |

Intel Macs are no longer supported as of v0.2 — the release matrix targets Apple Silicon only. Use the web PWA on Intel hardware.

## CLI

`werb convert` and `werb validate` for batch work from the shell — see [The `werb` CLI](./cli.md#install) for prebuilt binaries and a `cargo install` path.

## From source

Requirements: Node.js 20+, [pnpm](https://pnpm.io/), Rust toolchain (for the BeerXML WASM crate), and for desktop builds also a [Tauri toolchain](https://tauri.app/v2/guides/getting-started/prerequisites/).

```bash
git clone --recurse-submodules https://github.com/werb-dev/werb.git
cd werb
pnpm install
pnpm gen:types     # generate TS types from JSON Schemas
pnpm test          # full suite, ~430 tests

# Web dev:
pnpm -F @werb/desktop dev

# Desktop dev (Tauri):
pnpm -F @werb/desktop tauri:dev

# Production web build:
pnpm -F @werb/desktop build
```

The `vendor/beerjson/` submodule is required — it's where the validator and the Rust type generator read the BeerJSON 2.x schemas from. If you cloned without `--recurse-submodules`, run `git submodule update --init --recursive`.
