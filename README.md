# @trioforge/anvil

Headless UI primitives for Roblox games, built on [Vide](https://centau.github.io/vide/). Anvil owns behaviour: who gets gamepad selection, which modal is on top, how a press, a hold or a repeat fires, and when the Close button may close a screen. Your game owns every pixel and every sound.

Anvil started as the interface runtime of Fragile Delivery. Version 0.1 covers modals, selection and presses. Builders let your game supply the instances and artwork.

Read the documentation at <https://website.trio-forge.workers.dev/docs/anvil/>.

## Install

```sh
pnpm add @trioforge/anvil @rbxts/vide @rbxts/charm @rbxts/vide-charm @rbxts/services
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
import { atom } from "@rbxts/charm";
import { UserInputService } from "@rbxts/services";
import Vide from "@rbxts/vide";
import { installAnvil, Modal, startMenuRuntime, usePress, type AnvilAdapter, type InputDevice } from "@trioforge/anvil";

const device = atom<InputDevice>("Keyboard");
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
	device,
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
| `device` | Reads the current input device. Selection only moves while it is `"Gamepad"`, and highlights ignore `"Touch"`. It must be a Charm atom or computed, because Anvil reads it inside Charm effects. |
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

## Toggle

Call `useToggle` in a Vide scope. It reads your controlled `on` value and sends the next boolean to `onToggle`. Its action adds the reactive `Selected` attribute.

```tsx
import Vide, { source } from "@rbxts/vide";
import { useToggle } from "@trioforge/anvil";

export function SoundToggle() {
	const on = source(true);
	const toggle = useToggle({ on, onToggle: on });
	return <textbutton action={toggle.action} Text={() => toggle.on() ? "Sound on" : "Sound off"} />;
}
```

## Tabs

Call `tab(index)` inside each tab's Vide scope. Each binding exposes `selected` and writes `Selected`. Pressing the selected tab leaves `onSelect` untouched.

```tsx
import Vide, { source } from "@rbxts/vide";
import { useTabs, type TabsBinding } from "@trioforge/anvil";

function Tab(props: { tabs: TabsBinding; index: number }) {
	const tab = props.tabs.tab(props.index, { selectFirst: props.index === 1 });
	return <textbutton action={tab.action} Text={() => tab.selected() ? "Selected" : "Choose"} />;
}

export function SettingsTabs() {
	const selected = source(1);
	const tabs = useTabs({ selected, onSelect: selected });
	return <frame><Tab tabs={tabs} index={1} /><Tab tabs={tabs} index={2} /></frame>;
}
```

## Slider

`useSlider` clamps values to `min` and `max` and snaps to `step` from `min`. The defaults are `min = 0` and `step = 1`. The maximum remains reachable when the range has a partial final step. The caller owns the value and updates it through `onChange`.

Decrement and increment repeat while held. A changed hold calls `onCommit` once on release, including when reaching a bound cancels the pressed state. `set` and segment presses change and commit immediately. Disabled controls and unchanged values produce no change or commit. A segment writes `Selected` when its snapped value is at or below the current value. Create each segment binding in its own Vide scope.

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

`usePress` also accepts `onRelease`. It runs once when the input that began the press ends, even if the pressed state was cancelled earlier. Disposing the control disconnects the release listener.

## License

MIT
