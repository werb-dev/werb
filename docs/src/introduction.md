# Introduction

Werb is a **file-driven homebrewing tool**. Recipes in, brew sessions out — every artifact is plain JSON you can read, version, share, and round-trip with every other tool that speaks the format.

It runs three ways from the same codebase:

- A **desktop app** ([Tauri](https://tauri.app)) on macOS, Windows, and Linux.
- A **Progressive Web App** in any modern browser (including iPad Safari).
- A **command-line tool**, [`werb`](./cli.md), for batch conversion and validation.

## Why "file-driven"?

Most brewing apps lock recipes inside a proprietary cloud. Werb takes the opposite stance:

- Your recipes are **plain [BeerJSON 2.x](https://www.beerjson.com/) files** on your disk.
- Brew sessions are **plain JSON files** next to them.
- Every calculation has a **JSON Schema** you can audit.
- Sync to GitHub is **opt-in and explicit** — one repo, one Personal Access Token, one click per push or pull.

If Werb disappears tomorrow, your data is still BeerJSON — readable in every other brewing tool.

## What's in this guide

- **[Installation](./install.md)** — download the desktop app, open the PWA, or install the CLI.
- **[The CLI](./cli.md)** — `werb convert` and `werb validate`. Use it to bulk-import historical recipes, or to schema-check a folder before pushing.
- **[Sync to a GitHub repo](./sync.md)** — point Werb at a repo and let it write per-recipe `.beerjson` files into a folder you choose.
- **[Architecture](./architecture.md)** — for contributors and the curious.
- **[BeerJSON schema notes](./beerjson.md)** — what Werb supports, what it deliberately doesn't, and where the two diverge from upstream.

## Quick links

- [Source code on GitHub](https://github.com/werb-dev/werb)
- [Issue tracker](https://github.com/werb-dev/werb/issues)
- [Live PWA](https://werb-dev.github.io/werb/)
- [Latest release](https://github.com/werb-dev/werb/releases/latest)
