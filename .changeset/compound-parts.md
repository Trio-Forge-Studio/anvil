---
"@trioforge/anvil": minor
---

Add compound parts, `asChild` and focus scopes.

- `Tabs`, `Dialog`, `AlertDialog`, `Checkbox`, `Switch`, `Slider` and `TextField` are objects of parts, such as `Tabs.Root` and `Tabs.Trigger`, built on the hooks. Each `Root` takes its children as a function and shares its binding through a context. A part outside its root raises an error that names both.
- Parts render one host with Roblox's visible defaults turned off and pass other properties through, type-checked against the host class. With `asChild`, a part gives its behaviour to your single `GuiObject` child and moves UI modifiers beside it under it.
- Button parts, `Tabs.Trigger`, `Dialog.Trigger`, `Dialog.Close`, `AlertDialog.Action`, `AlertDialog.Cancel` and the roots of `Checkbox`, `Switch`, `Slider` and `TextField`, take plain children or a function that receives the part's binding: its `PressBinding`, with `selected` on a tab trigger, or the hook's binding on a root. With `asChild`, the function returns your element. `BindingChildren` and `ButtonPartProps` type them.
- `FocusScope` replaces `Modal`. A `trapped` scope owns selection and close input while it is topmost, and trapped scopes nest. Every scope restores the control that was selected when it opened, falling back to the scope underneath when that control is gone, hidden or disabled. Replace `<Modal onClose={close}>` with `<FocusScope trapped onClose={close}>`. The props `name`, `size`, `position`, `anchorPoint`, `layoutOrder` and `zIndex` become the `Frame` properties `Name`, `Size`, `Position`, `AnchorPoint`, `LayoutOrder` and `ZIndex`.
- `AlertDialog` becomes `AlertDialog.Root`, `Content`, `Action` and `Cancel`, with `open`, `defaultOpen` and `onOpenChange`. `AlertDialogProps`, `AlertDialogBinding`, `DialogAction`, `ModalProps` and `Placement` are removed.
- Tab triggers move with the arrow axis of `Tabs.Root`'s `orientation`, wrapping unless `loop` is `false`. `useTabs` and `Tabs.Root` take `activationMode`. The default, `"Manual"`, activates a trigger only when it is pressed, so selection passing through a tab row no longer switches page. `"Automatic"` also activates a trigger when it is selected.
- Selection fallbacks skip controls whose `Disabled` attribute is set.
