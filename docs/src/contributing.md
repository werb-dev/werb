# Contributing

Issues and pull requests welcome — see the [README's Contributing section](https://github.com/werb-dev/werb#contributing) for the contract-first workflow.

## Editing these docs

Every page on this site has an **Edit this page** link in the top-right that opens the source file (`docs/src/*.md`) on GitHub with a fresh fork ready to commit. For larger changes, clone the repo and:

```bash
cargo install mdbook              # one-time
cd docs
mdbook serve --open                # live-preview at http://localhost:3000
```

mdBook hot-reloads on every save, so writing here feels close to writing in a notebook.

The docs site is built and deployed automatically alongside the PWA — every push to `main` rebuilds [`https://werb-dev.github.io/werb/docs/`](https://werb-dev.github.io/werb/docs/).
