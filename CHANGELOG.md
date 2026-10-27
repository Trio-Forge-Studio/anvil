# @trioforge/anvil

## 0.2.0

### Minor Changes

- [#3](https://github.com/Trio-Forge-Studio/anvil/pull/3) [`57466cf`](https://github.com/Trio-Forge-Studio/anvil/commit/57466cf368e29c2cef6ff33e56dd1f5705e375c9) Thanks [@Hezaerd](https://github.com/Hezaerd)! - Add compound parts, `asChild` and focus scopes.
  
  - `Tabs`, `Dialog`, `AlertDialog`, `Checkbox`, `Switch`, `Slider` and `TextField` are objects of parts, such as `Tabs.Root` and `Tabs.Trigger`, built on the hooks. Each `Root` takes its children as a function and shares its binding through a context. A part outside its root raises an error that names both.
  - Parts render one host with Roblox's visible defaults turned off and pass other properties through, type-checked against the host class. With `asChild`, a part gives its behaviour to your single `GuiObject` child and moves UI modifiers beside it under it.
  - Button parts, `Tabs.Trigger`, `Dialog.Trigger`, `Dialog.Close`, `AlertDialog.Action`, `AlertDialog.Cancel` and the roots of `Checkbox`, `Switch`, `Slider` and `TextField`, take plain children or a function that receives the part's binding: its `PressBinding`, with `selected` on a tab trigger, or the hook's binding on a root. With `asChild`, the function returns your element. `BindingChildren` and `ButtonPartProps` type them.
  - `FocusScope` replaces `Modal`. A `trapped` scope owns selection and close input while it is topmost, and trapped scopes nest. Every scope restores the control that opened it: the control whose press opened it, or else the control that was selected. A top bar icon is restored only when its press opened the scope. When the target is gone, hidden or disabled, the scope underneath picks instead. Opening a trapped scope clears a selection left on a control outside it. Replace `<Modal onClose={close}>` with `<FocusScope trapped onClose={close}>`. The props `name`, `size`, `position`, `anchorPoint`, `layoutOrder` and `zIndex` become the `Frame` properties `Name`, `Size`, `Position`, `AnchorPoint`, `LayoutOrder` and `ZIndex`.
  - `AlertDialog` becomes `AlertDialog.Root`, `Content`, `Action` and `Cancel`, with `open`, `defaultOpen` and `onOpenChange`. `AlertDialogProps`, `AlertDialogBinding`, `DialogAction`, `ModalProps` and `Placement` are removed.
  - `onOpenChange` on `Dialog.Root` and `AlertDialog.Root` receives a reason with the new state. A dialog reports `"Trigger"`, `"Close"` or `"Dismiss"`, and an alert dialog reports `"Action"`, `"Cancel"` or `"Dismiss"`, where `"Dismiss"` is close input. `onPress` on `Action` and `Cancel` no longer refuses by returning `false`. To keep a dialog open, control `open` and ignore the change. The roots pass `{ open }` to their children function.
  - Tab triggers move with the arrow axis of `Tabs.Root`'s `orientation`, wrapping unless `loop` is `false`. `useTabs` and `Tabs.Root` take `activationMode`. The default, `"Manual"`, activates a trigger only when it is pressed, so selection passing through a tab row no longer switches page. `"Automatic"` also activates a trigger when it is selected.
  - Selection fallbacks skip controls whose `Disabled` attribute is set.

- [#2](https://github.com/Trio-Forge-Studio/anvil/pull/2) [`beec677`](https://github.com/Trio-Forge-Studio/anvil/commit/beec6770e6ee9a5f5436c93d1e1b2f076828771e) Thanks [@Hezaerd](https://github.com/Hezaerd)! - Add the headless hooks layer and drop Charm.
  
  - Anvil no longer depends on `@rbxts/charm` or `@rbxts/vide-charm`. Its state is Vide `source`, `derive` and `effect`, and `AnvilAdapter.device` is a reactive getter, `() => InputDevice`. It must be Vide state, such as a `source`: a Charm atom still type-checks but no longer updates Anvil.
  - Every press binding writes `Highlighted`, `Pressed` and `Disabled` attributes, named by the exported `Attribute`.
  - `useControllable` gives a hook controlled or uncontrolled state: pass `value` to own it, or let the hook start from `defaultValue`. Changes report through `onChange`, and equal values are skipped.
  - `useToggle` takes `checked`, `defaultChecked` and `onCheckedChange` and writes `Checked`.
  - `useTabs` takes `value`, `defaultValue`, `onValueChange` and `disabled`. Its `trigger(value)` bindings are keyed by value and write `Selected`. Pressing the selected trigger reports nothing.
  - `useSlider` is a drag slider with mouse, touch, D-pad, arrow key and thumbstick input. It takes `value`, `defaultValue`, `min`, `max`, `step`, `onValueChange` and `onValueCommit`, which runs once per drag or hold that changed the value. Its `control` writes `Dragging`, `Highlighted` and `Disabled`.
  - `useTextField` takes `value`, `defaultValue`, `onValueChange`, `onSubmit` and `onValueCommit`, with `control` for the button and `box` for the `TextBox`.
  - `AlertDialog` closes through cancel on close input, and a destructive dialog selects cancel first.
  - `Topbar.Root` and `Topbar.Icon` draw TopbarPlus-style icons in Roblox's top bar, and `useTopbarIcon` drives your own. Icons take `selected`, `defaultSelected` and `onSelectedChange`, stay pressable while a modal is open, and take DPadUp focus on a gamepad. `Topbar.Label` draws text that can't be pressed, like TopbarPlus's locked label icons.

- [#4](https://github.com/Trio-Forge-Studio/anvil/pull/4) [`99b115d`](https://github.com/Trio-Forge-Studio/anvil/commit/99b115d7607613be2b3ff80f7762078bce9a21e2) Thanks [@Hezaerd](https://github.com/Hezaerd)! - Add `PanZoom` and `usePanZoom`, a headless pan and zoom viewport for maps and skill trees.
  
  - `PanZoom.Root`, `Viewport` and `Content` are parts over `usePanZoom`. `Viewport` and `Content` take `asChild`. The root passes the binding to its children function: `view()`, `fit()`, `scale()`, `half()`, `dragging()`, `panTo(point, { glide })` and `zoomTo(zoom, anchor)`.
  - The left mouse button or one touch drags. The mouse wheel zooms by 1.15 per notch around the cursor when the viewport is the topmost `Active` or opaque object under it. A pinch that starts over the viewport zooms around its midpoint and cancels the drag.
  - The zoom stays between `minZoom` and `maxZoom`, 0.5 and 1.6 by default. `clampPan(pan, scale, half)` bounds the pan. By default, content larger than the viewport keeps covering it and smaller content stays centred.
  - `fit(viewportSize)` scales the content at zoom 1 and defaults to fitting it inside the viewport. Sizes are measured in logical pixels, so drags and the fit stay correct under a `UIScale` above the viewport.
  - When gamepad selection moves to a control inside the content, the view glides until the control is at least 100 pixels inside the viewport. `followSelection` sets the insets or turns this off. With Reduced Motion on, glides jump instead.
  - `gamepad={{ pan, zoom }}` pans with the right thumbstick and zooms with L2 and R2. It is off by default and leaves the left thumbstick and the D-pad to Roblox's selection.
  - Input, glides and gamepad control stop while the owner's scope is covered by a trapped scope or the Roblox menu is open. The view `{ pan, zoom }` is controllable through `view`, `defaultView` and `onViewChange`. The viewport writes `Dragging`.

- [#5](https://github.com/Trio-Forge-Studio/anvil/pull/5) [`afa4dc1`](https://github.com/Trio-Forge-Studio/anvil/commit/afa4dc14644379cc5c3bef32fe747c182c96a8c3) Thanks [@Hezaerd](https://github.com/Hezaerd)! - Add `RadioGroup` and `useRadioGroup` for picking one value from a set.
  
  - `RadioGroup.Root` takes `value`, `defaultValue`, `onValueChange`, `disabled`, `orientation` and `loop`, and renders nothing of its own. `RadioGroup.Item` takes `value`, `disabled`, `selectFirst` and `asChild`, and passes its binding with `checked` to function children. `RadioGroup.Indicator` shows only while its item is checked.
  - Items write `Checked` and are checked only when pressed. Arrow movement follows `orientation`, `"Vertical"` by default, and stops at both ends unless `loop` is `true`.

## 0.1.3

### Patch Changes

- [`6d69587`](https://github.com/Trio-Forge-Studio/anvil/commit/6d6958746d9954cc2afaf0df251b7b0355b5a5a2) Thanks [@Hezaerd](https://github.com/Hezaerd)! - The source moved to its own repository, [Trio-Forge-Studio/anvil](https://github.com/Trio-Forge-Studio/anvil), so the package's repository and issue links point there. Its homepage is now its docs page at <https://website.trio-forge.workers.dev/docs/anvil/>. The code is the same as the previous version.

## 0.1.2

### Patch Changes

- [#6](https://github.com/Trio-Forge-Studio/packages/pull/6) [`dac820b`](https://github.com/Trio-Forge-Studio/packages/commit/dac820b44abb72c663f694c6125de44e1a1a8fcd) Thanks [@Hezaerd](https://github.com/Hezaerd)! - The source moved to [Trio-Forge-Studio/packages](https://github.com/Trio-Forge-Studio/packages), so the package's repository and issue links point there. The package now ships its `CHANGELOG.md`. The code is the same as the previous version.

## 0.1.1

### Patch Changes

- Publish from the release workflow, with provenance. The code is the same as 0.1.0. ([Trio-Forge-Studio/anvil#2](https://github.com/Trio-Forge-Studio/anvil/pull/2))

## 0.1.0

### Minor Changes

- First release. `Modal` ranks open modals by `DisplayOrder`, gives the top one gamepad selection and closes it on B. `usePress` turns a `GuiButton` into a button with press, hold and repeat. `installAnvil` connects the game's input and sounds, and `startMenuRuntime` runs selection and the close action. ([Trio-Forge-Studio/anvil#1](https://github.com/Trio-Forge-Studio/anvil/pull/1))
