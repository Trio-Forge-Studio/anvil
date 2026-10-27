# @trioforge/anvil

Headless UI components for Roblox games, built on [Vide](https://centau.github.io/vide/). Anvil handles the behaviour, such as which control gets gamepad selection, which modal is on top, how a press, a hold or a repeat fires, and when the Close button may close a screen. Your game draws every pixel and plays every sound, except the top bar icons and labels, which Anvil draws for you.

Anvil started as the UI code of Fragile Delivery. It has focus scopes, selection, presses, hooks and compound parts, and your game supplies the instances and the artwork.

The documentation is at <https://website.trio-forge.workers.dev/docs/anvil/>.

## Install

```sh
pnpm add @trioforge/anvil @rbxts/vide @rbxts/services
```

roblox-ts only finds packages in the scopes your project lists, so you need to add the `@trioforge` scope in two places.

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

Your game gives Anvil the input device and the close input through an adapter, and the adapter receives Anvil's feedback. Install the adapter once, on the client, before any Anvil UI renders, and then start the menu runtime.

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

Calling `installAnvil` again with the same adapter does nothing, and calling it with a different one raises an error. Anvil reads the adapter when the first control renders or the runtime starts, and raises an error if you never installed one.

| Member | What Anvil does with it |
| --- | --- |
| `device` | Reads the current input device. Selection only moves while it is `"Gamepad"`, and on `"Touch"` only a slider being dragged is highlighted. It must be reactive in Vide, such as a `source` or `derive`, because Anvil reads it inside Vide effects. |
| `close.held` | Asks whether the close input is down. A screen closes only on a fresh press, so a press that started before the screen opened does nothing. |
| `close.onPressed` | Subscribes to close presses. The topmost native trapped scope's `onClose` runs on each armed press. |
| `close.onReleased` | Subscribes to anything that may have lifted the close input. Anvil reads `close.held` again each time, so extra calls are harmless. |
| `claimMenuInput` | Runs while a native trapped scope is on top and no text box has focus. Return a function that releases the claim, for example to stop gameplay actions from reading ButtonB. |
| `feedback` | Receives `"Focus"`, `"Press"` or `"Refused"` for each press that is not `silent`. Play your sounds here. |

Anvil's state, such as `modalOpen()` and the getter that `useModalActive()` returns, is Vide state. Other reactive libraries can't track it, so a Charm `computed` that reads `modalOpen()` computes once and never updates. To use it from Charm, copy it into an atom from a Vide effect, in a root that lives as long as the game:

```ts nocheck
import { atom } from "@rbxts/charm";
import { effect, root } from "@rbxts/vide";
import { modalOpen as anvilModalOpen } from "@trioforge/anvil";

export const modalOpen = atom(false);
root(() => effect(() => modalOpen(anvilModalOpen())));
```

Copy a `useModalActive()` getter the same way, with an `effect` in the component that called it, so that the effect ends when the component unmounts.

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
- `FocusScope` takes its children as a function, so that the controls inside know which scope they belong to. It renders a transparent, full-size `Frame`, and any other `Frame` properties you pass go to that frame.
- A `trapped` scope is modal. Anvil ranks trapped scopes by their `ScreenGui`'s `DisplayOrder` and then by the order they opened in. The top one gets gamepad selection, blocks presses underneath and receives close input through `onClose`. Trapped scopes nest, so a small picker can open inside a screen. Use `modalOpen()` to pause gameplay while any trapped scope is open.
- When a scope closes while it holds the selection, it selects the control that opened it. That is the control whose press opened the scope, even a mouse click while gamepad selection was somewhere else. Without such a press, it is the control that was selected when the scope opened. A top bar icon is a target only when its own press opened the scope. If the target is gone, hidden or disabled, the scope underneath picks its own best control instead. Pass `restoreFocus={false}` to skip this. A trapped scope still clears a selection left inside it when it closes. Restoring follows the `device` rule, so outside a gamepad session nothing is selected after a scope closes.
- Opening a trapped scope clears a selection left on a control outside it, because controls outside a trapped scope can't be selected while it is open.
- A scope without `trapped`, such as a panel that swaps its content, restores the selection only when it unmounts while holding it.

## Parts

Parts are ready-made components built on the hooks described later in this README. Each component is an object of parts, such as `Tabs.Root` and `Tabs.Trigger`, and each part wraps the matching hook, so the behaviour is the same whether you use the parts or the hooks.

| Component | Parts | Built on |
| --- | --- | --- |
| `Tabs` | `Root`, `List`, `Trigger`, `Content` | `useTabs` |
| `RadioGroup` | `Root`, `Item`, `Indicator` | `useRadioGroup` |
| `Dialog` | `Root`, `Trigger`, `Content`, `Close` | `FocusScope` |
| `AlertDialog` | `Root`, `Content`, `Action`, `Cancel` | `FocusScope` |
| `Checkbox` | `Root`, `Indicator` | `useToggle` |
| `Switch` | `Root`, `Thumb` | `useToggle` |
| `Slider` | `Root`, `Track`, `Range`, `Thumb` | `useSlider` |
| `TextField` | `Root`, `Input` | `useTextField` |
| `Topbar` | `Root`, `Icon`, `Label` | `useTopbarIcon` |
| `PanZoom` | `Root`, `Viewport`, `Content` | `usePanZoom` |

- Vide builds JSX children before their parent, so a root can't give context to children written inside its tags. That is why each `Root` except `Topbar.Root` takes its children as a function. It sets up the context and then calls the function with the hook's binding, and parts at any depth inside that function can read the context. A part rendered outside its root raises an error that names both, such as `Tabs.Trigger must be used inside Tabs.Root`.
- `Tabs.Content`, `Dialog.Content` and `AlertDialog.Content` also take a children function. It runs each time the content mounts.
- Button parts take plain children or a function of their binding. The button parts are `Tabs.Trigger`, `RadioGroup.Item`, `Dialog.Trigger`, `Dialog.Close`, `AlertDialog.Action`, `AlertDialog.Cancel` and the roots of `Checkbox`, `Switch`, `Slider` and `TextField`. A trigger or dialog button passes its `PressBinding`, with `selected` added on a tab trigger and `checked` on a radio item, and a root passes its hook's binding. Styled children can then read `highlighted`, `pressed` or `selected` directly. With `asChild`, the function returns your element. Anvil calls a function child exactly once, so return reactive children such as `show(…)` from it instead of passing them directly.
- Except for `Topbar.Icon` and `Topbar.Label`, which draw a styled icon and label, a part renders one host, a `textbutton`, `frame` or `textbox`, with Roblox's visible defaults turned off. The text is empty, `AutoButtonColor` is off, and the background is transparent with no border. Parts set no colours or sizes, except that dialog content fills its parent so it can hold selection. Other properties and events pass through to the host and are type-checked against its class.
- Every part takes `asChild` except the roots of `Tabs`, `RadioGroup`, `Dialog`, `AlertDialog`, `PanZoom` and `Topbar`, and the `Topbar.Icon` and `Topbar.Label` parts, which draw their own artwork. With it, the part renders nothing of its own and gives its behaviour to your element. The children must resolve to exactly one `GuiObject`. UI modifiers beside it, such as `uicorner`, `uipadding`, `uilistlayout` or `uistroke`, move under it, and anything else raises an error. The part connects its own handlers, so handlers already on your element keep running.
- Apart from the top bar parts, parts write only these properties on their host: `Selectable`, `NextSelectionUp`, `NextSelectionDown`, `NextSelectionLeft`, `NextSelectionRight`, `SelectionImageObject` and the Anvil attributes. Dialog content also writes `SelectionGroup` and the four `SelectionBehavior` properties. A few parts draw state: `Checkbox.Indicator` and `RadioGroup.Indicator` write `Visible`, `Slider.Range` writes `Size`, `Slider.Thumb` writes `Position`, and `TextField.Input` writes `Text`, `TextEditable` and `ClearTextOnFocus`. `PanZoom.Viewport` writes `Active` and adds a `ScaleProbe` frame, and `PanZoom.Content` writes `AnchorPoint`, `Position`, `Size` and `Visible` and adds a `UIScale`. In Studio, an `asChild` control warns when your element already sets one of the selection properties.

### Tabs

`Tabs.Root` takes `value`, `defaultValue`, `onValueChange`, `disabled` and `activationMode`, like `useTabs`. Triggers register in the order they render. While a trigger is selected, its `NextSelection` links along the root's `orientation` point at the next and previous enabled triggers, so the D-pad, thumbstick and arrow keys move along the list through Roblox's own navigation. Movement wraps around unless `loop` is `false`. By default, moving through the triggers only selects them, and the player presses one to activate it. With `activationMode="Automatic"`, selecting a trigger also activates it. `Tabs.Content` mounts while its value is active.

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

### Radio group

`RadioGroup.Root` takes `value`, `defaultValue`, `onValueChange` and `disabled`, like `useRadioGroup`, and renders nothing, so the items go in your own layout. Items register in the order they render, and selection moves along the root's `orientation`, `"Vertical"` by default. It stops at both ends unless `loop` is `true`. Unlike tabs, there is no automatic mode, and an item is checked only when the player presses it. Each item writes `Checked`, and `RadioGroup.Indicator` inside an item's children function shows only while that item is checked.

```tsx
import Vide from "@rbxts/vide";
import { RadioGroup } from "@trioforge/anvil";

const QUALITIES = ["Low", "Medium", "High"] as const;
type Quality = (typeof QUALITIES)[number];

export function QualityPicker(props: { onValueChange: (quality: Quality) => void }) {
	return (
		<frame Size={UDim2.fromOffset(372, 48)} BackgroundTransparency={1}>
			<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 8)} />
			<RadioGroup.Root<Quality> defaultValue="Medium" orientation="Horizontal" onValueChange={props.onValueChange}>
				{() =>
					QUALITIES.map((quality) => (
						<RadioGroup.Item value={quality} asChild>
							{(item) => (
								<textbutton
									Text={quality}
									Size={UDim2.fromOffset(116, 48)}
									BackgroundColor3={() => (item.checked() ? Color3.fromRGB(255, 214, 102) : Color3.fromRGB(240, 240, 240))}
								/>
							)}
						</RadioGroup.Item>
					))
				}
			</RadioGroup.Root>
		</frame>
	);
}
```

### Dialog

`Dialog.Root` takes `open`, `defaultOpen` and `onOpenChange`, and passes `{ open }` to its children function. `Dialog.Trigger` opens the dialog and `Dialog.Close` closes it. `onOpenChange` receives the new state and a reason: `"Trigger"`, `"Close"`, or `"Dismiss"` when close input such as ButtonB closed the content. `Dialog.Content` is a trapped `FocusScope`, so while it is open it gets gamepad selection and close input. When it closes, it selects the trigger again. `Dialog.Close` is the content's fallback selection when nothing in it asks to be selected first. Render the content in a `ScreenGui` whose `DisplayOrder` puts it above what it covers.

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

`AlertDialog.Root` takes `open`, `defaultOpen` and `onOpenChange`, like `Dialog.Root`. `AlertDialog.Content` is a trapped scope that mounts while open. `AlertDialog.Action` runs its `onPress`, then closes with the reason `"Action"`. `AlertDialog.Cancel` does the same with `"Cancel"` and is the scope's fallback selection. Close input closes the dialog with `"Dismiss"` without running either `onPress`. Each close reports exactly one reason, so an Action press never also reports a Cancel or a Dismiss. To keep the dialog open after a press, pass `open` and ignore the change. Action is selected first, or Cancel when the root is `destructive`.

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

`Checkbox.Root` and `Switch.Root` take the `useToggle` options and render the button. `Checkbox.Indicator` is visible only while checked, and `Switch.Thumb` writes `Checked` so you can style it. `Slider.Root` takes the `useSlider` options and renders the control that the player selects. `Slider.Track` spans the range, `Slider.Range` fills it up to the value, and `Slider.Thumb` sits at the value with its `AnchorPoint` centred. With `asChild`, the thumb leaves `AnchorPoint` to your element. `TextField.Root` takes the `useTextField` options and renders the button that starts editing, and `TextField.Input` is its `TextBox`. Each root passes its hook binding to its children function.

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

Every press action writes the boolean attributes `Highlighted`, `Pressed` and `Disabled` as soon as it attaches, and keeps them up to date. The hooks below add `Checked`, `Selected`, `Dragging`, `Editing`, `Invalid` and `Notice`. Import the frozen `Attribute` names to read them from your styling code.

```ts
import { Attribute } from "@trioforge/anvil";

export function isHighlighted(button: GuiButton) {
	return button.GetAttribute(Attribute.Highlighted) === true;
}
```

## Controlled and uncontrolled state

Every stateful hook follows the same rule. If you pass the value, such as `checked` or `value`, the hook is controlled. It reads your value, and a change only calls the matching `on…Change`, so you decide whether to apply it. If you leave it out, the hook keeps its own state, starts from the `default…` option and still reports each change. A change to the value it already has is skipped. Use `useControllable` to give your own components and hooks the same controlled and uncontrolled state.

```ts
import { useControllable } from "@trioforge/anvil";

export function useOpen(props: { open?: () => boolean; onOpenChange?: (open: boolean) => void }) {
	const [open, setOpen] = useControllable({ value: props.open, defaultValue: false, onChange: props.onOpenChange });
	return { open, toggle: () => setOpen(!open()) };
}
```

## Toggle

Call `useToggle` in a Vide scope for a checkbox or a switch. Each press flips `checked` and reports it to `onCheckedChange`, and its action keeps the `Checked` attribute in step with `checked`.

```tsx
import Vide from "@rbxts/vide";
import { useToggle } from "@trioforge/anvil";

export function SoundToggle(props: { onCheckedChange: (checked: boolean) => void }) {
	const toggle = useToggle({ defaultChecked: true, onCheckedChange: props.onCheckedChange });
	return <textbutton action={toggle.action} Text={() => (toggle.checked() ? "Sound on" : "Sound off")} />;
}
```

## Tabs

Tabs are keyed by value, not by position. Call `trigger(value)` inside each trigger's Vide scope. Each binding has `selected` and writes `Selected`, and pressing the selected trigger reports nothing. `activationMode` is `"Manual"` by default, so a trigger activates only when pressed. When Roblox's gamepad navigation passes through a manual tab row on the way to other controls, the row doesn't switch page. With `"Automatic"`, selecting a trigger also activates it. `disabled` on `useTabs` disables every trigger, and `disabled` on a trigger disables only that one.

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

## Radio group

`useRadioGroup` keys items by value, like `useTabs`. Call `item(value)` inside each item's Vide scope. Each binding has `checked` and writes `Checked`, and pressing the checked item reports nothing. Items are checked only by a press, never by selection moving onto them. `disabled` on `useRadioGroup` disables every item, and `disabled` on an item disables only that one.

## Slider

`useSlider` makes a slider the player drags. Attach `control` to the `GuiButton` that the player selects, and `track` to the `GuiObject` that spans the slider's range.

- A mouse or touch press on the control or the track jumps to the pointer and drags until that input lifts.
- While the control is selected, D-pad Left and Right, the Left and Right arrow keys, and a horizontal thumbstick push each move the value by `step`. Holding one repeats after 0.4 s and speeds up to one step every 0.04 s. The control's `NextSelectionLeft` and `NextSelectionRight` point at the control itself, so Roblox's navigation never takes that input.
- Values clamp to `min` and `max` and snap to multiples of `step` counted from `min`. The defaults are `min = 0` and `step = 1`. When the range doesn't divide evenly into steps, the player can still reach the maximum.
- The value is controllable through `value`, `defaultValue` and `onValueChange`. `onValueCommit` runs once with the final value when a drag or hold that changed the value ends. The gesture ends when the input lifts, the window loses focus, the gamepad disconnects, the slider unmounts, or the slider is disabled or blocked by a modal, text editing or the Roblox menu.
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

Attach `control` to your `GuiButton` and `box` to its `TextBox`. A press on the control gives the box focus, and the control writes `Editing` and `Invalid` as well as the press attributes. The box can't be reached by gamepad selection, and while it has focus, Anvil releases the menu input.

The text is controllable through `value`, `defaultValue` and `onValueChange`, and writing a controlled `value` never calls `onValueChange`. `completionText` keeps what the player typed and adds the rest of the completion after it. Enter accepts the completion before `onSubmit` and `onValueCommit` run. Losing focus always calls `onValueCommit`. `maxLength` limits input and submitted completions in bytes, the way Luau string slicing counts. `autoFocus` waits until just after the field mounts, and gives the box focus only if the field still exists, is enabled and is in the scope on top.

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

## Pan and zoom

`PanZoom` lets the player pan and zoom around content larger than the screen, such as a world map or a skill tree. `PanZoom.Root` takes the `usePanZoom` options and passes its binding to the children function. `PanZoom.Viewport` renders a transparent `Frame` that fills its parent and receives the input. `PanZoom.Content` holds your content at `contentSize` logical pixels, centred in the viewport, moved by the pan and scaled by a `UIScale`. The content stays hidden until the viewport has a size.

```tsx
import Vide from "@rbxts/vide";
import { PanZoom, usePress } from "@trioforge/anvil";

const mapSize = new Vector2(1200, 800);
const pins = [new Vector2(200, 150), new Vector2(600, 400), new Vector2(1000, 650)];

function Pin(props: { point: Vector2; onPress: () => void }) {
	const press = usePress({ onPress: props.onPress });
	return (
		<textbutton
			action={press.action}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={UDim2.fromOffset(props.point.X, props.point.Y)}
			Size={UDim2.fromOffset(120, 48)}
			BackgroundColor3={() => (press.highlighted() ? Color3.fromRGB(255, 214, 102) : Color3.fromRGB(240, 240, 240))}
		/>
	);
}

export function WorldMap() {
	return (
		<PanZoom.Root contentSize={mapSize} maxZoom={2} gamepad={{ pan: true, zoom: true }}>
			{(map) => (
				<PanZoom.Viewport ClipsDescendants>
					<PanZoom.Content>
						<imagelabel Image="rbxassetid://0" Size={UDim2.fromScale(1, 1)} />
						{pins.map((point) => (
							<Pin point={point} onPress={() => map.panTo(point, { glide: true })} />
						))}
					</PanZoom.Content>
					<textlabel
						Text={() => `${math.round(map.view().zoom * 100)}%`}
						Position={UDim2.fromOffset(12, 12)}
						Size={UDim2.fromOffset(80, 24)}
					/>
				</PanZoom.Viewport>
			)}
		</PanZoom.Root>
	);
}
```

- The left mouse button or a single touch drags the content. The mouse wheel zooms by 1.15 per notch around the cursor. The wheel zooms only when the cursor is over the viewport and the topmost `Active` or opaque `GuiObject` under it is the viewport itself or something inside `PanZoom.Content`, so an opaque overlay such as a tooltip blocks it. A two-finger pinch that starts over the viewport zooms around its midpoint and cancels the drag.
- Anvil keeps every zoom it sets between `minZoom` and `maxZoom`, 0.5 and 1.6 by default, and passes every pan it sets through `clampPan(pan, scale, half)`. A controlled `view` that you pass is used as given. On each axis, the default keeps content that is larger than the viewport covering it, and centres content that is smaller.
- At zoom 1, the content is scaled by `fit(viewportSize)`, which by default fits the whole content inside the viewport. Anvil measures the viewport in logical pixels, so a `UIScale` above it changes neither the fit nor drag distances. A transparent `ScaleProbe` frame in the viewport measures that scale, and Anvil measures the fit again when the viewport's size or that scale changes.
- When gamepad selection moves to a control inside the content, the view glides until the control's centre is at least 100 pixels inside each edge of the viewport. Pass `followSelection={{ inset: { topLeft, bottomRight } }}` to change the insets, or `false` to turn it off. Mouse hover and touch never select a control, so they never move the view.
- `panTo(point, { glide })` centres a content point, for example a node the player tapped. `zoomTo(zoom, anchor)` zooms around a content point, or around the viewport centre without one.
- With Reduced Motion on, both selection following and `panTo(point, { glide: true })` jump straight to their target.
- `gamepad={{ pan: true, zoom: true }}` adds gamepad controls. The right thumbstick pans at up to 900 pixels a second past a 0.2 deadzone, and R2 and L2 zoom in and out around the viewport centre by a factor of 2 each second. Anvil listens to this input without blocking it, so the left thumbstick and the D-pad still move Roblox's selection.
- Nothing moves while a trapped scope above the pan zoom's own scope is open, or while the Roblox menu is open. A drag in progress ends and a glide stops. Gamepad controls also stop while text is being edited or the viewport is hidden.
- The view, `{ pan, zoom }`, is controllable through `view`, `defaultView` and `onViewChange`. The pan is in content pixels: the offset of the content centre from the viewport centre before scaling. A content point `p` sits `(p - contentSize / 2 + view().pan) * scale()` logical pixels from the viewport centre, where `scale()` is `fit() * view().zoom`. Use that with `half()`, half the viewport's logical size, to place overlays such as tooltips inside `PanZoom.Viewport`.
- The viewport writes `Dragging`. Call `usePanZoom` directly and attach `viewport` and `content` to your own frames to skip the parts.

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

- `selected` is controllable. Pressing an unselected icon reports `true` to `onSelectedChange`, and pressing a selected one reports `false`. When you pass `selected`, your state decides whether the icon lights up. Without it, the icon keeps its own state, starting from `defaultSelected`.
- An icon stays pressable while a trapped scope is open, so it can close the screen it opened. The Roblox menu still blocks it.
- On a gamepad in play mode, DPadUp selects the last selected icon, or else the leftmost visible, enabled icon.
- The caption appears after the mouse hovers for half a second, and never on touch or gamepad.
- `Topbar.Label` draws plain text in the same pill, such as a frame-rate readout. It takes `name`, `text` and `order`, grows with its text and can't be pressed or selected.
- To draw your own icon, call `useTopbarIcon` with the same options and attach its `action` to a button inside `Topbar.Root`. It writes `Highlighted`, `Pressed`, `Disabled`, `Selected` and a numeric `Notice` attribute, and returns `captionShown` for your caption.

## License

MIT
