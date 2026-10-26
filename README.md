# @trioforge/anvil

Headless UI primitives for Roblox games, built on [Vide](https://centau.github.io/vide/). Anvil owns behaviour: who gets gamepad selection, which modal is on top, how a press, a hold or a repeat fires, and when the Close button may close a screen. Your game owns every pixel and every sound.

Anvil started as the interface runtime of Fragile Delivery. It provides modals, selection, presses, and component builders. Builders let your game supply the instances and artwork.

Read the documentation at <https://website.trio-forge.workers.dev/docs/anvil/>.

## Install

```sh
pnpm add @trioforge/anvil @rbxts/vide @rbxts/services
```

roblox-ts only looks for packages in the scopes your project lists, so add the `@trioforge` scope in two places.

1. In `tsconfig.json`, add it to `typeRoots`:

	```json
	"typeRoots": ["node_modules/@rbxts", "node_modules/@trioforge"]
	```

2. In your Rojo project, map it beside `@rbxts` under `rbxts_include/node_modules`:

	```json
	"node_modules": {
		"$className": "Folder",
		"@rbxts": { "$path": "node_modules/@rbxts" },
		"@trioforge": { "$path": "node_modules/@trioforge" }
	}
	```

## Connect your game

Anvil reads input and gives feedback only through an adapter that you install once, on the client, before any Anvil UI renders. Then start the menu runtime.

```ts group=readme
import { UserInputService } from "@rbxts/services";
import Vide, { source } from "@rbxts/vide";
import { installAnvil, Modal, startMenuRuntime, usePress, type AnvilAdapter, type InputDevice } from "@trioforge/anvil";

const device = source<InputDevice>("Keyboard");
UserInputService.LastInputTypeChanged.Connect((input) => {
	if (input === Enum.UserInputType.Touch) device("Touch");
	else if (input === Enum.UserInputType.Gamepad1) device("Gamepad");
	else if (input === Enum.UserInputType.Keyboard || input === Enum.UserInputType.MouseMovement) device("Keyboard");
});

function onButtonB(signal: RBXScriptSignal<(input: InputObject) => void>, listener: () => void) {
	const connection = signal.Connect((input) => {
		if (input.KeyCode === Enum.KeyCode.ButtonB) listener();
	});
	return () => connection.Disconnect();
}

const sounds = new Map<string, Sound>();

const adapter: AnvilAdapter = {
	device: () => device(),
	close: {
		held: () =>
			UserInputService.GetConnectedGamepads().some((gamepad) =>
				UserInputService.IsGamepadButtonDown(gamepad, Enum.KeyCode.ButtonB),
			),
		onPressed: (listener) => onButtonB(UserInputService.InputBegan, listener),
		onReleased: (listener) => onButtonB(UserInputService.InputEnded, listener),
	},
	claimMenuInput: () => () => {},
	feedback: (kind) => sounds.get(kind)?.Play(),
};

installAnvil(adapter);
startMenuRuntime();
```

`installAnvil` accepts the same adapter again and does nothing. It refuses a different adapter. Anvil reads the adapter when the first control renders or the runtime starts, and raises an error if you never installed one.

| Member | What Anvil does with it |
| --- | --- |
| `device` | Reads the current input device. Selection only moves while it is `"Gamepad"`, and highlights ignore `"Touch"`. It must be reactive in Vide, such as a `source` or `derive`, because Anvil reads it inside Vide effects. |
| `close.held` | Asks whether the close input is down. A screen closes only on a fresh press, so a press that started before the screen opened does nothing. |
| `close.onPressed` | Subscribes to close presses. The top native modal's `onClose` runs on each armed press. |
| `close.onReleased` | Subscribes to anything that may have lifted the close input. Anvil reads `close.held` again each time, so extra calls are harmless. |
| `claimMenuInput` | Runs while a native modal is on top and no text box has focus. Return a function that releases the claim, for example to stop gameplay actions from reading ButtonB. |
| `feedback` | Receives `"Focus"`, `"Press"` or `"Refused"` for each press that is not `silent`. Play your sounds here. |

## Build a modal

```tsx group=readme
function BuyButton(props: { onBuy: () => void }) {
	const press = usePress({ onPress: props.onBuy, selectFirst: true });
	return (
		<textbutton
			action={press.action}
			Text="Buy"
			Size={() => (press.pressed() ? UDim2.fromOffset(112, 38) : UDim2.fromOffset(120, 40))}
			BackgroundColor3={() => (press.highlighted() ? Color3.fromRGB(255, 214, 102) : Color3.fromRGB(240, 240, 240))}
		/>
	);
}

export function Shop(props: { onBuy: () => void; onClose: () => void }) {
	return <Modal name="Shop" onClose={props.onClose}>{() => <BuyButton onBuy={props.onBuy} />}</Modal>;
}
```

- `usePress` returns `highlighted`, `pressed` and `progress` getters, and an `action` that you attach to your own `GuiButton`. Pass `hold` for a hold-to-confirm button, or `repeating` for a button that repeats while held.
- `Modal` takes its children as a function, so the controls inside know which modal owns them.
- The topmost modal, ranked by its `ScreenGui`'s `DisplayOrder`, owns gamepad selection and blocks presses underneath. Use `modalOpen()` to pause gameplay while any modal is open.

## Interaction attributes

Every press action writes boolean `Highlighted`, `Pressed`, and `Disabled` attributes immediately and updates them reactively. Import the frozen `Attribute` names to read them in your styling engine.

```ts
import { Attribute } from "@trioforge/anvil";

export function isHighlighted(button: GuiButton) {
	return button.GetAttribute(Attribute.Highlighted) === true;
}
```

## Controlled and uncontrolled state

Every stateful hook follows the same rule. Pass the value, such as `checked` or `value`, and the hook is controlled. It reads your value, and a change only calls the matching `on…Change`, so you decide whether to apply it. Leave it out and the hook keeps its own state, starting from the `default…` option and still reporting each change. A change to the current value is skipped. `useControllable` is the same rule as a hook, for your own components.

```ts
import { useControllable } from "@trioforge/anvil";

export function useOpen(props: { open?: () => boolean; onOpenChange?: (open: boolean) => void }) {
	const [open, setOpen] = useControllable({ value: props.open, defaultValue: false, onChange: props.onOpenChange });
	return { open, toggle: () => setOpen(!open()) };
}
```

## Toggle

Call `useToggle` in a Vide scope for a checkbox or a switch. Each press flips `checked` and reports it to `onCheckedChange`. Its action adds the reactive `Checked` attribute.

```tsx
import Vide from "@rbxts/vide";
import { useToggle } from "@trioforge/anvil";

export function SoundToggle(props: { onCheckedChange: (checked: boolean) => void }) {
	const toggle = useToggle({ defaultChecked: true, onCheckedChange: props.onCheckedChange });
	return <textbutton action={toggle.action} Text={() => (toggle.checked() ? "Sound on" : "Sound off")} />;
}
```

## Tabs

Tabs are keyed by value, not position. Call `trigger(value)` inside each trigger's Vide scope. Each binding exposes `selected` and writes `Selected`. Pressing the selected trigger reports nothing. `disabled` on `useTabs` disables every trigger, and `disabled` on a trigger disables only that one.

```tsx
import Vide, { source } from "@rbxts/vide";
import { useTabs, type TabsBinding } from "@trioforge/anvil";

type Page = "General" | "Audio";

function Trigger(props: { tabs: TabsBinding<Page>; value: Page }) {
	const trigger = props.tabs.trigger(props.value, { selectFirst: () => props.tabs.value() === props.value });
	return <textbutton action={trigger.action} Text={props.value} />;
}

export function SettingsTabs() {
	const page = source<Page>("General");
	const tabs = useTabs({ value: page, onValueChange: page });
	return <frame><Trigger tabs={tabs} value="General" /><Trigger tabs={tabs} value="Audio" /></frame>;
}
```

## Slider

`useSlider` clamps values to `min` and `max` and snaps to `step` from `min`. The defaults are `min = 0` and `step = 1`. The maximum remains reachable when the range has a partial final step. The caller owns the value and updates it through `onChange`.

Decrement and increment repeat while held. A changed hold calls `onCommit` once when it ends, whether the input lifts, the pointer leaves, the step reaches its bound, or the slider unmounts. `set` and segment presses change and commit immediately. Disabled controls and unchanged values produce no change or commit. A segment writes `Selected` when its snapped value is at or below the current value. Create each segment binding in its own Vide scope.

```tsx
import Vide, { source } from "@rbxts/vide";
import { useSlider } from "@trioforge/anvil";

export function Volume() {
	const value = source(5);
	const slider = useSlider({ value, max: 10, onChange: value, selectFirst: true });
	const middle = slider.segment(5);
	return <frame>
		<textbutton action={slider.decrement.action} Text="-" />
		<textbutton action={middle.action} Text={() => tostring(slider.value())} />
		<textbutton action={slider.increment.action} Text="+" />
	</frame>;
}
```

## Text field

Attach `control` to your `GuiButton` and `box` to its `TextBox`. The control captures focus and writes `Editing` and `Invalid` alongside the press attributes. The box stays outside gamepad selection and uses the existing text editing runtime to release menu input while focused.

The text is controllable through `value`, `defaultValue` and `onValueChange`. Writing a controlled `value` never calls `onValueChange`. `completionText` preserves typed text and appends the untyped completion suffix. Enter accepts the completion before `onSubmit` and `onValueCommit`. A blur always calls `onValueCommit`. `maxLength` limits input and submitted completions in bytes, matching Luau string slicing. Deferred `autoFocus` checks that the binding is still alive, enabled, and in the active modal.

```tsx
import Vide from "@rbxts/vide";
import { useTextField } from "@trioforge/anvil";

export function NameField(props: { onValueCommit: (name: string) => void }) {
	const field = useTextField({ maxLength: 24, selectFirst: true, onValueCommit: props.onValueCommit });
	return <textbutton action={field.control} Text="">
		<textbox action={field.box} />
		<textlabel Text={() => field.completionText() ?? ""} />
	</textbutton>;
}
```

## Alert dialog

`AlertDialog` wraps `Modal` and passes press options to your child function. It selects cancel first for a destructive dialog that has `onCancel`. Otherwise it selects confirm. Close input invokes `onCancel` when supplied, then falls back to `onClose`. Callbacks own dismissal, as with `Modal`.

```tsx
import Vide from "@rbxts/vide";
import { AlertDialog, usePress, type DialogAction } from "@trioforge/anvil";

function DialogButton(props: DialogAction & { text: string }) {
	const press = usePress(props);
	return <textbutton action={press.action} Text={props.text} />;
}

export function DeleteDialog(props: { onConfirm: () => void; onCancel: () => void }) {
	return <AlertDialog {...props} destructive>
		{(dialog) => <frame>
			<DialogButton {...dialog.confirm} text="Delete" />
			{dialog.cancel && <DialogButton {...dialog.cancel} text="Cancel" />}
		</frame>}
	</AlertDialog>;
}
```

## Top bar

`Topbar.Root` returns a `ScreenGui` that covers Roblox's top bar inset, and `Topbar.Icon` draws a TopbarPlus-style round icon inside it. Mount the root under `PlayerGui` with a `displayOrder` above your modals, or their backgrounds swallow its clicks. Icons sort by `order`.

```tsx
import { Players } from "@rbxts/services";
import Vide, { mount, source } from "@rbxts/vide";
import { Topbar } from "@trioforge/anvil";

const settingsOpen = source(false);
const unread = source(2);

mount(
	() => (
		<Topbar.Root side="Right" displayOrder={12}>
			<Topbar.Icon
				name="Settings"
				image="rbxassetid://0"
				caption="Settings"
				order={1}
				notice={unread}
				selected={settingsOpen}
				onSelectedChange={settingsOpen}
			/>
		</Topbar.Root>
	),
	Players.LocalPlayer.WaitForChild("PlayerGui"),
);
```

- `selected` is controllable. Pressing an unselected icon reports `true` to `onSelectedChange`, and pressing a selected one reports `false`. When you pass `selected`, your state decides whether the icon lights up. Without it, the icon flips its own state from `defaultSelected`.
- An icon stays pressable while a modal is open, so it can close the modal it opened. The Roblox menu still blocks it.
- On a gamepad in play mode, DPadUp selects the last selected icon, or else the leftmost visible, enabled icon.
- The caption appears after half a second of mouse hover and never on touch or gamepad.
- To draw your own icon, call `useTopbarIcon` with the same options and attach its `action` to a button inside `Topbar.Root`. It writes `Highlighted`, `Pressed`, `Disabled`, `Selected` and a numeric `Notice` attribute, and returns `captionShown` for your caption.

## License

MIT
