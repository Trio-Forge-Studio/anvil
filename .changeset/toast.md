---
"@trioforge/anvil": minor
---

Add `createToaster` and the `Toast.Viewport` and `Toast.Root` parts for toasts that leave by themselves.

- A toaster is a plain object that needs no Vide root. It takes `limit`, `overflow`, `duration` and `exitTimeout`, and has `add`, `update`, `close`, `clear`, `pause` and a reactive `toasts()`. Adding a toast with an id that is already shown replaces it in place.
- `Toast.Viewport` shows one toaster at one of six placements, as a list or a deck that expands on hover. It measures and glides each `Toast.Root`, pauses the timers while the player is busy with the stack, and dismisses a toast on a touch swipe.
- The children function receives a `ToastBinding`. Its `act` runs the toast's action, refuses when the action returns `false`, and never consumes a toast that was replaced while its action ran. `holdExit` keeps a leaving toast mounted while your exit animation plays.
- `Toast.Root` writes the new `Closing`, `Expanded`, `Swiping` and `Depth` attributes, as well as `Highlighted`.
- Anvil never selects a control inside a toast for the player and never restores the selection to one, while Roblox's own navigation still reaches it.
