# @trioforge/anvil

Headless UI primitives for Roblox games, built on [Vide](https://centau.github.io/vide/). Anvil owns behaviour: who gets gamepad selection, which modal is on top, how a press, a hold or a repeat fires, and when the Close button may close a screen. Your game owns every pixel and every sound.

Anvil started as the interface runtime of Fragile Delivery. It provides focus scopes, selection, presses, hooks and compound parts. Your game supplies the instances and artwork.

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
import { FocusScope, installAnvil, startMenuRuntime, usePress, type AnvilAdapter, type InputDevice } from "@trioforge/anvil";

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
| `close.onPressed` | Subscribes to close presses. The topmost native trapped scope's `onClose` runs on each armed press. |
| `close.onReleased` | Subscribes to anything that may have lifted the close input. Anvil reads `close.held` again each time, so extra calls are harmless. |
| `claimMenuInput` | Runs while a native trapped scope is on top and no text box has focus. Return a function that releases the claim, for example to stop gameplay actions from reading ButtonB. |
| `feedback` | Receives `"Focus"`, `"Press"` or `"Refused"` for each press that is not `silent`. Play your sounds here. |

Anvil's state, such as `modalOpen()` and the getter `useModalActive()` returns, is Vide state. Another reactive library cannot track it, so a Charm `computed` that reads `modalOpen()` computes once and never updates. Mirror it into an atom from a Vide effect in a root that lives as long as the game:

```ts nocheck
import { atom } from "@rbxts/charm";
import { effect, root } from "@rbxts/vide";
import { modalOpen as anvilModalOpen } from "@trioforge/anvil";

export const modalOpen = atom(false);
root(() => effect(() => modalOpen(anvilModalOpen())));
```

Mirror a `useModalActive()` getter the same way, with an `effect` in the component that called it, so the effect ends when the component unmounts.

## Build a screen

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
	return (
		<FocusScope trapped Name="Shop" onClose={props.onClose}>
			{() => <BuyButton onBuy={props.onBuy} />}
		</FocusScope>
	);
}
```

- `usePress` returns `highlighted`, `pressed` and `progress` getters, and an `action` that you attach to your own `GuiButton`. Pass `hold` for a hold-to-confirm button, or `repeating` for a button that repeats while held.
- `FocusScope` takes its children as a function, so the controls inside know which scope owns them. It renders a transparent full-size `Frame`, and other `Frame` properties pass through to it.
- A `trapped` scope is modal. The topmost one, ranked by its `ScreenGui`'s `DisplayOrder` and then by opening order, owns gamepad selection, blocks presses underneath and receives close input through `onClose`. Trapped scopes nest, so a small picker can open inside a screen. Use `modalOpen()` to pause gameplay while any trapped scope is open.
- When a scope closes while it holds selection, it selects the control that opened it. That is the control whose press opened the scope, even a mouse click while gamepad selection was elsewhere, or else the control that was selected when it opened. A top bar icon is a target only when its own press opened the scope. If the target is gone, hidden or disabled, the scope underneath picks its own best control instead. Pass `restoreFocus={false}` to skip this. Restoring follows the `device` rule, so outside a gamepad session nothing is selected after a scope closes.
- Opening a trapped scope clears a selection left on a control outside it, because those controls stop being selectable while the trap is open.
- A scope without `trapped` only restores selection when it unmounts while holding it, for example a panel that swaps content.

## Parts

Parts are the compound layer over the hooks later in this README. Each primitive is an object of parts, such as `Tabs.Root` and `Tabs.Trigger`, and each part wraps the matching hook, so the behaviour is the same whichever layer you use.

| Primitive | Parts | Built on |
| --- | --- | --- |
| `Tabs` | `Root`, `List`, `Trigger`, `Content` | `useTabs` |
| `Dialog` | `Root`, `Trigger`, `Content`, `Close` | `FocusScope` |
| `AlertDialog` | `Root`, `Content`, `Action`, `Cancel` | `FocusScope` |
| `Checkbox` | `Root`, `Indicator` | `useToggle` |
| `Switch` | `Root`, `Thumb` | `useToggle` |
| `Slider` | `Root`, `Track`, `Range`, `Thumb` | `useSlider` |
| `TextField` | `Root`, `Input` | `useTextField` |
| `Topbar` | `Root`, `Icon`, `Label` | `useTopbarIcon` |

- Vide builds JSX children before their parent, so a root cannot give context to children written inside its tags. Each `Root` except `Topbar.Root` takes its children as a function instead. It sets up the context, then calls the function with the hook's binding. Parts at any depth inside that function read the context. A part rendered outside its root raises an error that names both, such as `Tabs.Trigger must be used inside Tabs.Root`.
- `Tabs.Content`, `Dialog.Content` and `AlertDialog.Content` also take a children function. It runs each time the content mounts.
- Button parts take plain children or a function of their binding. The button parts are `Tabs.Trigger`, `Dialog.Trigger`, `Dialog.Close`, `AlertDialog.Action`, `AlertDialog.Cancel` and the roots of `Checkbox`, `Switch`, `Slider` and `TextField`. A trigger or dialog button passes its `PressBinding`, with `selected` added on a tab trigger, and a root passes its hook's binding. Styled children can then read `highlighted`, `pressed` or `selected` directly. With `asChild`, the function returns your element. A function child is always called once with the binding, so return reactive children such as `show(…)` from it rather than passing them directly.
- A part renders one host, a `textbutton`, `frame` or `textbox`, with Roblox's visible defaults turned off. The text is empty, `AutoButtonColor` is off, and the background is transparent with no border. Parts set no colours or sizes, except that dialog content fills its parent so it can hold selection. Other properties and events pass through to the host and are type-checked against its class.
- Every part except the roots of `Tabs`, `Dialog`, `AlertDialog` and `Topbar` takes `asChild`. The part then renders nothing of its own and gives its behaviour to your element. The children must resolve to exactly one `GuiObject`. UI modifiers beside it, such as `uicorner`, `uipadding`, `uilistlayout` or `uistroke`, move under it. Anything else raises an error. The part connects its own handlers, so handlers already on your element keep running.
- Parts write only these properties on their host: `Selectable`, `NextSelectionUp`, `NextSelectionDown`, `NextSelectionLeft`, `NextSelectionRight`, `SelectionImageObject` and the Anvil attributes. Dialog content also writes `SelectionGroup` and the four `SelectionBehavior` properties. A few parts draw state: `Checkbox.Indicator` writes `Visible`, `Slider.Range` writes `Size`, `Slider.Thumb` writes `Position`, and `TextField.Input` writes `Text`, `TextEditable` and `ClearTextOnFocus`. In Studio, an `asChild` control warns when your element already sets one of the selection properties.

### Tabs

`Tabs.Root` takes `value`, `defaultValue`, `onValueChange`, `disabled` and `activationMode`, like `useTabs`. Triggers register in the order they render. While a trigger is selected, its `NextSelection` links on the root's `orientation` point at the next and previous enabled triggers, so the D-pad, thumbstick and arrow keys move along the list through Roblox's own navigation. Movement wraps unless `loop` is `false`. By default, moving through the triggers only selects them and a press activates one. With `activationMode="Automatic"`, selecting a trigger also activates it. `Tabs.Content` mounts while its value is active.

```tsx
import Vide from "@rbxts/vide";
import { Tabs } from "@trioforge/anvil";

type Page = "General" | "Audio";

function Trigger(props: { value: Page }) {
	return (
		<Tabs.Trigger value={props.value} asChild>
			{(trigger) => (
				<textbutton
					Text={props.value}
					Size={UDim2.fromOffset(120, 36)}
					BackgroundColor3={() => (trigger.selected() ? Color3.fromRGB(255, 214, 102) : Color3.fromRGB(240, 240, 240))}
					BackgroundTransparency={() => (trigger.highlighted() ? 0 : 0.2)}
				>
					<uicorner />
				</textbutton>
			)}
		</Tabs.Trigger>
	);
}

export function SettingsTabs() {
	return (
		<Tabs.Root<Page> defaultValue="General">
			{() => (
				<frame Size={UDim2.fromOffset(400, 300)} BackgroundTransparency={1}>
					<Tabs.List Size={new UDim2(1, 0, 0, 36)}>
						<uilistlayout FillDirection={Enum.FillDirection.Horizontal} />
						<Trigger value="General" />
						<Trigger value="Audio" />
					</Tabs.List>
					<Tabs.Content value="General" Position={UDim2.fromOffset(0, 44)} Size={new UDim2(1, 0, 1, -44)}>
						{() => <textlabel Text="General settings" Size={UDim2.fromScale(1, 1)} />}
					</Tabs.Content>
					<Tabs.Content value="Audio" Position={UDim2.fromOffset(0, 44)} Size={new UDim2(1, 0, 1, -44)}>
						{() => <textlabel Text="Audio settings" Size={UDim2.fromScale(1, 1)} />}
					</Tabs.Content>
				</frame>
			)}
		</Tabs.Root>
	);
}
```

### Dialog

`Dialog.Root` takes `open`, `defaultOpen` and `onOpenChange`, and passes `{ open }` to its children function. `Dialog.Trigger` opens the dialog and `Dialog.Close` closes it. `onOpenChange` receives the new state and a reason: `"Trigger"`, `"Close"`, or `"Dismiss"` when close input such as ButtonB closed the content. `Dialog.Content` is a trapped `FocusScope`, so while it is open it owns gamepad selection and close input. When it closes, it selects the trigger again. `Dialog.Close` is the content's fallback selection when nothing in it asks to be selected first. Render the content in a `ScreenGui` whose `DisplayOrder` puts it above what it covers.

```tsx
import Vide from "@rbxts/vide";
import { Dialog } from "@trioforge/anvil";

export function ControlsDialog() {
	return (
		<Dialog.Root>
			{() => [
				<Dialog.Trigger Text="Controls" Size={UDim2.fromOffset(120, 40)} />,
				<Dialog.Content>
					{() => (
						<frame AnchorPoint={new Vector2(0.5, 0.5)} Position={UDim2.fromScale(0.5, 0.5)} Size={UDim2.fromOffset(320, 200)}>
							<textlabel Text="A to select, B to go back" Size={new UDim2(1, 0, 0, 40)} />
							<Dialog.Close asChild>
								<textbutton Text="Done" Position={UDim2.fromOffset(100, 140)} Size={UDim2.fromOffset(120, 40)}>
									<uicorner />
								</textbutton>
							</Dialog.Close>
						</frame>
					)}
				</Dialog.Content>,
			]}
		</Dialog.Root>
	);
}
```

### Alert dialog

`AlertDialog.Root` takes `open`, `defaultOpen` and `onOpenChange`, like `Dialog.Root`. `AlertDialog.Content` is a trapped scope that mounts while open. `AlertDialog.Action` runs its `onPress`, then closes with the reason `"Action"`. `AlertDialog.Cancel` does the same with `"Cancel"` and is the scope's fallback selection. Close input closes the dialog with `"Dismiss"` without running either `onPress`. Each close reports exactly one reason, so an Action press never also reports a Cancel or a Dismiss. To keep the dialog open after a press, pass `open` and ignore that change. Action is selected first, or Cancel when the root is `destructive`.

```tsx
import Vide from "@rbxts/vide";
import { AlertDialog } from "@trioforge/anvil";

export function DeleteDialog(props: { open: () => boolean; onOpenChange: (open: boolean) => void; onDelete: () => void }) {
	return <AlertDialog.Root open={props.open} onOpenChange={props.onOpenChange} destructive>
		{() => <AlertDialog.Content>
			{() => <frame Size={UDim2.fromOffset(320, 160)}>
				<AlertDialog.Action onPress={props.onDelete} Text="Delete" Size={UDim2.fromOffset(120, 40)} />
				<AlertDialog.Cancel Text="Cancel" Size={UDim2.fromOffset(120, 40)} />
			</frame>}
		</AlertDialog.Content>}
	</AlertDialog.Root>;
}
```

### Checkbox, switch, slider and text field

`Checkbox.Root` and `Switch.Root` take the `useToggle` options and render the button. `Checkbox.Indicator` is visible only while checked, and `Switch.Thumb` writes `Checked` so you can style it. `Slider.Root` takes the `useSlider` options and renders the selectable control. `Slider.Track` spans the range, `Slider.Range` fills it up to the value, and `Slider.Thumb` sits at the value with its `AnchorPoint` centred. `TextField.Root` takes the `useTextField` options and renders the button that starts editing, and `TextField.Input` is its `TextBox`. Each root passes its hook binding to its children function.

```tsx
import Vide from "@rbxts/vide";
import { Slider } from "@trioforge/anvil";

export function VolumeSlider(props: { onValueCommit: (volume: number) => void }) {
	return (
		<Slider.Root max={10} defaultValue={5} onValueCommit={props.onValueCommit} Size={new UDim2(1, 0, 0, 48)}>
			{() => (
				<Slider.Track Position={new UDim2(0, 12, 0.5, -4)} Size={new UDim2(1, -24, 0, 8)}>
					<Slider.Range BackgroundTransparency={0} />
					<Slider.Thumb Size={UDim2.fromOffset(20, 20)} BackgroundTransparency={0} />
				</Slider.Track>
			)}
		</Slider.Root>
	);
}
```

## Interaction attributes

Every press action writes boolean `Highlighted`, `Pressed`, and `Disabled` attributes immediately and updates them reactively. The hooks below add `Checked`, `Selected`, `Dragging`, `Editing`, `Invalid` and `Notice`. Import the frozen `Attribute` names to read them in your styling engine.

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

Tabs are keyed by value, not position. Call `trigger(value)` inside each trigger's Vide scope. Each binding exposes `selected` and writes `Selected`. Pressing the selected trigger reports nothing. `activationMode` is `"Manual"` by default, so a trigger activates only when pressed. Roblox's own gamepad navigation passes through tab rows on the way to other controls, and a manual row never switches page on the way. With `"Automatic"`, selecting a trigger also activates it. `disabled` on `useTabs` disables every trigger, and `disabled` on a trigger disables only that one.

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

`useSlider` is a drag slider. Attach `control` to the selectable `GuiButton` and `track` to the `GuiObject` that spans the slider's range.

- A mouse or touch press on the control or the track jumps to the pointer and drags until that input lifts.
- While the control is selected, D-pad Left and Right, the Left and Right arrow keys, and a horizontal thumbstick push step by `step`. A hold repeats after 0.4 s and speeds up to one step every 0.04 s. The control's `NextSelectionLeft` and `NextSelectionRight` point at itself, so Roblox's navigation never takes that input.
- Values clamp to `min` and `max` and snap to `step` from `min`. The defaults are `min = 0` and `step = 1`. The maximum remains reachable when the range has a partial final step.
- The value is controllable through `value`, `defaultValue` and `onValueChange`. `onValueCommit` runs once with the final value when a drag or hold that changed the value ends. It ends when the input lifts, the window loses focus, the gamepad disconnects, the slider is disabled or blocked by a modal, text editing or the Roblox menu, or the slider unmounts.
- `control` writes `Dragging`, `Highlighted` and `Disabled`. A disabled slider refuses each gesture with `"Refused"` feedback unless it is `silent`.

```tsx
import Vide from "@rbxts/vide";
import { useSlider } from "@trioforge/anvil";

export function Volume(props: { onValueCommit: (volume: number) => void }) {
	const slider = useSlider({ defaultValue: 5, max: 10, selectFirst: true, onValueCommit: props.onValueCommit });
	return <textbutton action={slider.control} Text="" Size={new UDim2(1, 0, 0, 48)}>
		<frame action={slider.track} Size={new UDim2(1, -24, 0, 8)} Position={new UDim2(0, 12, 0.5, -4)}>
			<frame Size={() => UDim2.fromScale(slider.fraction(), 1)} />
		</frame>
	</textbutton>;
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
- An icon stays pressable while a trapped scope is open, so it can close the screen it opened. The Roblox menu still blocks it.
- On a gamepad in play mode, DPadUp selects the last selected icon, or else the leftmost visible, enabled icon.
- The caption appears after half a second of mouse hover and never on touch or gamepad.
- `Topbar.Label` draws plain text in the same pill, such as a frame-rate readout. It takes `name`, `text` and `order`, grows with its text and can't be pressed or selected.
- To draw your own icon, call `useTopbarIcon` with the same options and attach its `action` to a button inside `Topbar.Root`. It writes `Highlighted`, `Pressed`, `Disabled`, `Selected` and a numeric `Notice` attribute, and returns `captionShown` for your caption.

## License

MIT
