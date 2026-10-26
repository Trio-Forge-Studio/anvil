# Agent instructions

Anvil is a headless UI library for Roblox games, built on Vide and published as `@trioforge/anvil`. It owns selection, modal ownership and press behaviour. The game draws everything and supplies input and sounds through the `AnvilAdapter` it installs. Fragile Delivery is the first consumer.

## Tools

Run `pnpm install` and `rokit install`. `rokit.toml` pins Lune and StyLua. Vite+ (`vp`) formats and lints the repository from `vite.config.ts`, and `pnpm run fmt` fixes formatting. A pre-commit hook runs `vp check --fix` on staged files.

`tsconfig.json` extends `tsconfig.rbxts.json`, the roblox-ts options every Trio Forge library shares, and adds Vide's JSX settings. `tooling/lune/` has the roblox-ts runtime and the test runner, which Lune code requires as `@tooling/runtime` and `@tooling/test` through `.luaurc`. `tooling/check-examples.mjs` checks the examples. Each Trio Forge library keeps its own copy of `tooling/`, so a fix there belongs in the other libraries too.

## Checks

Run every check before you call a change done:

```sh
pnpm run check
```

It runs `vp check`, rbxtsc, StyLua over the Luau tests, the tests against the compiled package, and the README examples. Fix the cause of a failure rather than silencing it.

## Tests

- Specs live in `test/` and run against the compiled package in `out/` through roblox-ts's runtime. `test/lib/load.luau` returns a `require` for one module realm. Pass `packages`, `services` and `globals` to replace Vide, Charm, Roblox services and engine globals.
- `test/lib/harness.luau` drives the menu runtime with fake GuiService, UserInputService, instances and a test adapter. Assert what a game can observe: selection, `onClose` calls, presses, feedback kinds and the Menu claim.
- Keep pure rules, such as `modal-state`, `selection-policy` and `press-state`, free of engine and framework imports, so specs can load them directly.

## Docs examples

Every `ts` and `tsx` example in the README and the docs compiles against `src/`. `pnpm run examples <files>` compiles the examples in Markdown and MDX files. UI examples need the engine to run, so Anvil's examples compile and don't run. Blocks that share `group=<name>` in their info string build on each other, and `nocheck` skips a block.

The docs live in the website repository, under `src/content/docs/docs/anvil/`, and publish at <https://website.trio-forge.workers.dev/docs/anvil/>. The website checks their examples against the commit of this repository that its `docs-sources.json` pins. After changing an example or an API, check the docs from a website checkout beside this one, and update them in the website PR that moves the pin:

```sh
pnpm run examples README.md ../website/src/content/docs/docs/anvil/*.mdx ../website/src/content/docs/docs/anvil/*/*.mdx
```

## Releases

Changesets versions and publishes the package. A PR that changes what the package ships adds a changeset with `pnpm changeset`, which says whether it takes a patch, minor or major bump. On `main`, `.github/workflows/release.yml` keeps a "chore(release): version packages" PR open that applies the changesets and writes `CHANGELOG.md`. Merging that PR stages the new version through npm trusted publishing. The trusted publisher may only stage, so the version goes live once a maintainer approves it with 2FA on npmjs.com or with `npm stage approve`. Don't publish from a machine.

CI fails a PR that changes `src/` without a changeset. A change that ships nothing, such as tests, docs or tooling, needs none.

## Lockfile

The lockfile records the pinned pnpm under `packageManagerDependencies`, and CI's frozen install fails without it. A Vite+ shell sets `PNPM_CONFIG_PM_ON_FAIL=ignore`, which stops pnpm writing that block. If it goes missing, regenerate the lockfile:

```sh
env -u PNPM_CONFIG_PM_ON_FAIL -u PNPM_CONFIG_RUNTIME_ON_FAIL pnpm install
```

## Conventions

- `src` imports only itself and `@rbxts/vide`, `@rbxts/charm`, `@rbxts/vide-charm` and `@rbxts/services`. Game knowledge belongs in the adapter, never in Anvil.
- `src/index.ts` is the public surface. Keep everything else internal.
- Comment only what the code can't say: a non-obvious reason, a workaround, a trap.
- Commit messages are Conventional Commits with a scope: `feat(press): …`, `fix(runtime): …`, `test(selection): …`, `docs: …`.
