---
"@trioforge/anvil": minor
---

Add `RadioGroup` and `useRadioGroup` for picking one value from a set.

- `RadioGroup.Root` takes `value`, `defaultValue`, `onValueChange`, `disabled`, `orientation` and `loop`, and renders nothing of its own. `RadioGroup.Item` takes `value`, `disabled`, `selectFirst` and `asChild`, and passes its binding with `checked` to function children. `RadioGroup.Indicator` shows only while its item is checked.
- Items write `Checked` and are checked only when pressed. Arrow movement follows `orientation`, `"Vertical"` by default, and stops at both ends unless `loop` is `true`.
