---
"@trioforge/anvil": minor
---

Add the headless hooks layer and drop Charm.

- Anvil no longer depends on `@rbxts/charm` or `@rbxts/vide-charm`. Its state is Vide `source`, `derive` and `effect`, and `AnvilAdapter.device` is a reactive getter, `() => InputDevice`. It must be Vide state, such as a `source`: a Charm atom still type-checks but no longer updates Anvil.
- Every press binding writes `Highlighted`, `Pressed` and `Disabled` attributes, named by the exported `Attribute`.
- `useControllable` gives a hook controlled or uncontrolled state: pass `value` to own it, or let the hook start from `defaultValue`. Changes report through `onChange`, and equal values are skipped.
- `useToggle` takes `checked`, `defaultChecked` and `onCheckedChange` and writes `Checked`.
- `useTabs` takes `value`, `defaultValue`, `onValueChange` and `disabled`. Its `trigger(value)` bindings are keyed by value and write `Selected`. Pressing the selected trigger reports nothing.
- `useSlider` is a drag slider with mouse, touch, D-pad, arrow key and thumbstick input. It takes `value`, `defaultValue`, `min`, `max`, `step`, `onValueChange` and `onValueCommit`, which runs once per drag or hold that changed the value. Its `control` writes `Dragging`, `Highlighted` and `Disabled`.
- `useTextField` takes `value`, `defaultValue`, `onValueChange`, `onSubmit` and `onValueCommit`, with `control` for the button and `box` for the `TextBox`.
- `AlertDialog` builds on `Modal`. Close runs cancel, and a destructive dialog selects cancel first.
- `Topbar.Root` and `Topbar.Icon` draw TopbarPlus-style icons in Roblox's top bar, and `useTopbarIcon` drives your own. Icons take `selected`, `defaultSelected` and `onSelectedChange`, stay pressable while a modal is open, and take DPadUp focus on a gamepad. `Topbar.Label` draws text that can't be pressed, like TopbarPlus's locked label icons.
