# Sync to a GitHub repo

> 🚧 This page is a stub. Quick reference until it's fleshed out:

Werb syncs recipes to a GitHub repository of your choice, one file per recipe. The repo browses like a curated cookbook on github.com, and edits produce legible diffs on commit — the file-driven story from the README.

## What's synced

- **Recipes**, as one `<slug>.beerjson` file per recipe under a folder you pick (default `recipes/`).

## What's not synced

- Brew sessions, equipment profiles, unit preferences. They stay on this device.

## Setting it up

1. Create a fine-grained Personal Access Token on GitHub with `Contents: read+write` scoped to one repo.
2. In Werb → Settings → GitHub: paste the token, the `owner/repo`, the branch, and the recipes folder.
3. Hit **Verify & connect**.
4. **Push** writes every local recipe to the folder. **Pull** reads every file from the folder. The "Overwrite local recipes" checkbox decides what happens when a recipe name collides.

## Bootstrapping with the CLI

If you have a pile of historical recipes in BeerXML or BeerJSON, the [`werb` CLI](./cli.md#bootstrap-a-recipe-archive-on-github) is the fastest way to populate the repo before connecting Werb to it.
