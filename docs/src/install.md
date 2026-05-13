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

Intel Macs aren't currently published — the GitHub Actions Intel-macOS runner pool is queue-starved. Use the web PWA instead until that opens up.

## CLI

`werb convert` and `werb validate` for batch work from the shell — see [The `werb` CLI](./cli.md#install) for prebuilt binaries and a `cargo install` path.

## From source

The whole repo lives at <https://github.com/werb-dev/werb> and builds with `pnpm install && pnpm gen:types`. The README's [Quick start](https://github.com/werb-dev/werb#quick-start) section is the authoritative how-to — once it stabilises, the steps will move here.
