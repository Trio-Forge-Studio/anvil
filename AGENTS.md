# Agent instructions

Anvil is a headless UI library for Roblox games, built on Vide and published as `@trioforge/anvil`. It owns selection, modal ownership and press behaviour. The game draws everything and supplies input and sounds through the `AnvilAdapter` it installs. Fragile Delivery is the first consumer.

## Checks

Run every check before you call a change done:

```sh
pnpm run check
```

It runs rbxtsc, StyLua over the Luau tests, the tests against the compiled package, and the README examples. Fix the cause of a failure rather than silencing it.

## Tests

- Specs live in `test/` and run against the compiled package in `out/` through roblox-ts's runtime. `test/lib/load.luau` returns a `require` for one module realm. Pass `packages`, `services` and `globals` to replace Vide, Charm, Roblox services and engine globals.
- `test/lib/harness.luau` drives the menu runtime with fake GuiService, UserInputService, instances and a test adapter. Assert what a game can observe: selection, `onClose` calls, presses, feedback kinds and the Menu claim.
- Keep pure rules, such as `modal-state`, `selection-policy` and `press-state`, free of engine and framework imports, so specs can load them directly.

## Docs examples

The docs live in `apps/docs/src/content/docs/anvil/`. `pnpm run examples <files>` compiles the `ts` and `tsx` examples in Markdown and MDX files against `src`, as the root `AGENTS.md` describes. UI examples need the engine to run, so Anvil's examples compile and don't run. Run it on the Anvil docs in `apps/docs` after changing an example or an API:

```sh
pnpm run examples README.md ../../apps/docs/src/content/docs/anvil/*.mdx ../../apps/docs/src/content/docs/anvil/*/*.mdx
```

## Conventions

- `src` imports only itself and `@rbxts/vide`, `@rbxts/charm`, `@rbxts/vide-charm` and `@rbxts/services`. Game knowledge belongs in the adapter, never in Anvil.
- `src/index.ts` is the public surface. Keep everything else internal.
- Comment only what the code can't say: a non-obvious reason, a workaround, a trap.
- Commit messages are Conventional Commits with a scope: `feat(press): …`, `fix(runtime): …`, `test(selection): …`, `docs: …`.

## Releasing

Releases publish from CI. Bump `version` in `package.json` in a PR and merge it. Then tag that commit on `main` and push the tag:

```sh
git tag anvil-v0.2.0 origin/main
git push origin refs/tags/anvil-v0.2.0
```

The repository's `.github/workflows/release.yml` refuses a tag that isn't on `main` or doesn't match the version, runs `pnpm run check`, and publishes with `npm publish` through npm trusted publishing, with provenance. Don't publish from a machine.
