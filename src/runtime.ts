import { GuiService, UserInputService } from "@rbxts/services";
import { cleanup, context, derive, effect, read, root, source } from "@rbxts/vide";
import { adapter, type AnvilAdapter } from "./adapter";
import type { Value } from "./props";
import { enter, hasModal, leave, top, type ModalState } from "./modal-state";
import { decide, emptySelection, type Selection, type SelectionEvent } from "./selection-policy";
import { pickTopbarIcon } from "./topbar-policy";

export type Owner = number | "Base" | "Topbar";
export const ownerContext = context<Owner>("Base");
export const closeFallbackContext = context(false);
const state = source<ModalState<number>>({ entries: [] });
// Never destroyed, so module state stays derived for the life of the realm, inside or outside any Vide scope.
const [, derived] = root(() => ({
	modalOpen: derive(() => hasModal(state())),
	topId: derive(() => top(state())?.id),
}));
export const modalOpen = derived.modalOpen;
const topId = derived.topId;
export const selectedObject = source<GuiObject | undefined>(undefined);
export const textEditing = source(false);
export const menuOpen = source(false);
interface RootRecord {
	readonly id: number;
	readonly serial: number;
	readonly mode: "Native" | "Pointer";
	readonly onClose?: () => void;
	root?: GuiObject;
	close?: GuiObject;
	selection: Selection<GuiObject>;
	stopAttachment?: () => void;
}
interface Control {
	readonly owner: Owner;
	readonly buttonADown?: (input: InputObject) => void;
	readonly buttonAUp?: (input: InputObject) => void;
}
const roots = new Map<number, RootRecord>();
const controls = new Map<GuiObject, Control>();
const topbarIcons = new Map<GuiObject, () => boolean>();
let lastTopbarIcon: GuiObject | undefined;
let serial = 0;
let baseRestore: GuiObject | undefined;
let writing = false;
let generation = 0;
let waiting: RBXScriptConnection[] = [];
let selectedWatch: RBXScriptConnection[] = [];
let capturedA: { object: GuiObject; input: InputObject; control: Control } | undefined;
const runtimeOwners = new Set<object>();

// The primitives draw the hover/selection geometry; blank only kit controls so TopbarPlus keeps its artwork.
const blankSelectionImage = new Instance("Frame");
blankSelectionImage.Name = "SelectionImage";
blankSelectionImage.BackgroundTransparency = 1;

// The top bar draws above every modal, so its icons must stay pressable to close the modal they opened.
export function active(owner: Owner): boolean {
	if (owner === "Topbar") return true;
	return owner === "Base" ? !modalOpen() : topId() === owner;
}
function native(owner: Owner): boolean {
	if (owner === "Topbar") return !modalOpen();
	return active(owner) && (owner === "Base" || roots.get(owner)?.mode === "Native");
}
function finite(value: number): boolean {
	return value === value && math.abs(value) < math.huge;
}
function alive(object: GuiObject): boolean {
	if (!object.FindFirstAncestorOfClass("PlayerGui")) return false;
	let ancestor: Instance | undefined = object;
	while (ancestor) {
		if (ancestor.IsA("GuiObject") && !ancestor.Visible) return false;
		if (ancestor.IsA("LayerCollector") && !ancestor.Enabled) return false;
		ancestor = ancestor.Parent;
	}
	return true;
}
function ready(object: GuiObject, isRoot: boolean): boolean {
	if ((!isRoot && !object.Selectable) || !alive(object)) return false;
	let ancestor: Instance | undefined = object;
	while (ancestor) {
		if (ancestor.IsA("GuiObject")) {
			const size = ancestor.AbsoluteSize;
			const position = ancestor.AbsolutePosition;
			if (
				!finite(size.X) ||
				!finite(size.Y) ||
				!finite(position.X) ||
				!finite(position.Y) ||
				size.X < 0 ||
				size.Y < 0
			)
				return false;
			if ((ancestor === object || ancestor.ClipsDescendants) && (size.X < 1 || size.Y < 1)) return false;
		}
		ancestor = ancestor.Parent;
	}
	return true;
}
function disconnect(connections: RBXScriptConnection[]): void {
	for (const connection of connections) connection.Disconnect();
}
function watch(object: GuiObject, changed: () => void): RBXScriptConnection[] {
	const connections = [
		object.AncestryChanged.Connect(changed),
		object.GetPropertyChangedSignal("Selectable").Connect(changed),
	];
	let ancestor: Instance | undefined = object;
	while (ancestor) {
		if (ancestor.IsA("GuiObject")) {
			connections.push(ancestor.GetPropertyChangedSignal("AbsoluteSize").Connect(changed));
			connections.push(ancestor.GetPropertyChangedSignal("AbsolutePosition").Connect(changed));
			connections.push(ancestor.GetPropertyChangedSignal("Visible").Connect(changed));
			connections.push(ancestor.GetPropertyChangedSignal("ClipsDescendants").Connect(changed));
		} else if (ancestor.IsA("LayerCollector"))
			connections.push(ancestor.GetPropertyChangedSignal("Enabled").Connect(changed));
		ancestor = ancestor.Parent;
	}
	return connections;
}
function cancelRequest(): void {
	generation++;
	disconnect(waiting);
	waiting = [];
}
function writeSelection(object?: GuiObject): void {
	writing = true;
	GuiService.SelectedObject = object;
	selectedObject(object);
	writing = false;
}
function canSelect(owner: Owner): boolean {
	return native(owner) && adapter().device() === "Gamepad" && !menuOpen() && !textEditing();
}
function request(owner: Owner, target: GuiObject | "Root"): void {
	cancelRequest();
	const token = generation;
	const object = target === "Root" ? (typeIs(owner, "number") ? roots.get(owner)?.root : undefined) : target;
	if (!object) return;
	let queued = false;
	const retry = () => {
		if (token !== generation) return;
		queued = false;
		disconnect(waiting);
		waiting = [];
		if (!canSelect(owner)) return;
		if (target !== "Root" && controls.get(object)?.owner !== owner) return;
		if (ready(object, target === "Root")) {
			if (target === "Root") {
				writing = true;
				GuiService.Select(object);
				selectedObject(GuiService.SelectedObject);
				writing = false;
			} else writeSelection(object);
		} else waiting = watch(object, queue);
	};
	const queue = () => {
		if (!queued) {
			queued = true;
			task.defer(retry);
		}
	};
	queue();
}
function dispatch(id: number, event: SelectionEvent<GuiObject>): void {
	const record = roots.get(id);
	if (!record) return;
	const current = GuiService.SelectedObject;
	const decision = decide(record.selection, event, {
		current: current && controls.get(current)?.owner === id ? current : undefined,
		close: record.close,
		alive: (object) => controls.get(object)?.owner === id && alive(object),
		canSelect: canSelect(id),
	});
	record.selection = decision.selection;
	if (decision.target !== undefined) request(id, decision.target);
}
function cancelA(): void {
	const session = capturedA;
	capturedA = undefined;
	session?.control.buttonAUp?.(session.input);
}
function selectionChanged(): void {
	const previous = selectedObject();
	const current = GuiService.SelectedObject;
	selectedObject(current);
	disconnect(selectedWatch);
	selectedWatch = [];
	if (capturedA && capturedA.object !== current) cancelA();
	if (!writing) cancelRequest();
	if (current && topbarIcons.has(current)) lastTopbarIcon = current;
	const control = current && controls.get(current);
	if (current && control && typeIs(control.owner, "number"))
		dispatch(control.owner, { kind: "Selected", object: current });
	else if (!writing) {
		const previousControl = previous && controls.get(previous);
		const owner = previousControl?.owner;
		const id = topId();
		if (previous && typeIs(owner, "number") && active(owner))
			dispatch(owner, { kind: "Lost", removed: !alive(previous) });
		else if (id !== undefined && ((current && !control) || (previous && !previousControl)))
			dispatch(id, { kind: "Lost", removed: false });
	}
	if (current && control)
		selectedWatch = watch(current, () => {
			if (GuiService.SelectedObject !== current || !active(control.owner) || alive(current)) return;
			writeSelection();
			if (typeIs(control.owner, "number")) dispatch(control.owner, { kind: "Lost", removed: true });
		});
}

export function openRoot(mode: "Native" | "Pointer", onClose?: () => void): number {
	const id = ++serial;
	if (!modalOpen()) {
		const selected = GuiService.SelectedObject;
		baseRestore = selected && controls.get(selected)?.owner === "Base" ? selected : undefined;
	}
	roots.set(id, { id, serial: id, mode, onClose, selection: emptySelection() });
	state(enter(state(), { id, serial: id, order: undefined }));
	return id;
}
export function attachRoot(id: number, root: GuiObject): () => void {
	const record = roots.get(id);
	if (!record) return () => {};
	record.stopAttachment?.();
	record.root = root;
	let orderConnection: RBXScriptConnection | undefined;
	const update = () => {
		if (roots.get(id) !== record) return;
		orderConnection?.Disconnect();
		const gui = root.FindFirstAncestorWhichIsA("ScreenGui");
		if (gui) orderConnection = gui.GetPropertyChangedSignal("DisplayOrder").Connect(update);
		state(enter(state(), { id, serial: record.serial, order: gui?.DisplayOrder }));
	};
	const connection = root.AncestryChanged.Connect(update);
	update();
	const detach = () => {
		connection.Disconnect();
		orderConnection?.Disconnect();
	};
	record.stopAttachment = detach;
	return detach;
}
export function closeRoot(id: number): void {
	const record = roots.get(id);
	if (!record) return;
	record.stopAttachment?.();
	const wasTop = topId() === id || topId() === undefined;
	const selected = GuiService.SelectedObject;
	const selectedOwner = selected && controls.get(selected)?.owner;
	const restore = wasTop && !record.selection.paused && (selected === undefined || selectedOwner === id);
	if (selectedOwner === id) writeSelection();
	roots.delete(id);
	state(leave(state(), id));
	if (!modalOpen()) {
		const target = baseRestore;
		baseRestore = undefined;
		if (restore && target && controls.get(target)?.owner === "Base") request("Base", target);
	}
}
export function registerControl(object: GuiObject, control: Control, fallback = false): () => void {
	controls.set(object, control);
	object.SelectionImageObject = blankSelectionImage;
	const record = typeIs(control.owner, "number") ? roots.get(control.owner) : undefined;
	if (fallback && record) record.close = object;
	return () => {
		const selected = GuiService.SelectedObject === object;
		// Vide builds a replacement before disposing the selected control; clear before Roblox chooses a neighbour.
		if (selected) writeSelection();
		if (capturedA?.object === object) cancelA();
		controls.delete(object);
		if (record?.close === object) record.close = undefined;
		if (typeIs(control.owner, "number")) {
			dispatch(control.owner, { kind: "Unmarked", object });
			const owner = control.owner;
			if (selected) task.defer(() => dispatch(owner, { kind: "Lost", removed: true }));
		}
	};
}
export function registerTopbarIcon(object: GuiObject, disabled: () => boolean): () => void {
	topbarIcons.set(object, disabled);
	return () => {
		topbarIcons.delete(object);
		if (lastTopbarIcon === object) lastTopbarIcon = undefined;
	};
}
function selectTopbarIcon(): void {
	if (GuiService.SelectedObject !== undefined || !canSelect("Topbar")) return;
	const candidates = [...topbarIcons].map(([object, disabled]) => ({
		object,
		x: object.AbsolutePosition.X,
		available: alive(object) && !disabled(),
	}));
	const target = pickTopbarIcon(candidates, lastTopbarIcon);
	if (target) request("Topbar", target);
}
export function markControl(owner: Owner, object: GuiObject, marked: boolean): void {
	if (!typeIs(owner, "number")) return;
	const record = roots.get(owner);
	const current = GuiService.SelectedObject;
	const replaces = current && record?.selection.marked.includes(current) ? current : undefined;
	dispatch(owner, marked ? { kind: "Marked", object, replaces } : { kind: "Unmarked", object });
}
export function useSelection(
	options: {
		selectFirst?: Value<boolean>;
		buttonADown?: (input: InputObject) => void;
		buttonAUp?: (input: InputObject) => void;
	} = {},
) {
	const owner = ownerContext();
	const fallback = closeFallbackContext();
	const object = source<GuiObject>();
	const allowed = () => active(owner);
	effect(() => {
		const instance = object();
		if (instance) instance.Selectable = native(owner);
	});
	effect(() => {
		const instance = object();
		if (!instance) return;
		markControl(owner, instance, read(options.selectFirst ?? false));
		cleanup(() => markControl(owner, instance, false));
	});
	return {
		allowed,
		selected: () => object() !== undefined && selectedObject() === object(),
		action: (instance: GuiObject) => {
			const unregister = registerControl(
				instance,
				{ owner, buttonADown: options.buttonADown, buttonAUp: options.buttonAUp },
				fallback,
			);
			object(instance);
			cleanup(unregister);
		},
	};
}
export function startMenuRuntime(): () => void {
	const host = adapter();
	const token = {};
	runtimeOwners.add(token);
	if (runtimeOwners.size() === 1) start(host);
	return () => {
		if (runtimeOwners.delete(token) && runtimeOwners.isEmpty()) stop?.();
	};
}
let stop: (() => void) | undefined;
function start(host: AnvilAdapter): void {
	let armed = !host.close.held();
	let previousTop: number | undefined;
	const connections = [
		GuiService.GetPropertyChangedSignal("SelectedObject").Connect(selectionChanged),
		GuiService.GetPropertyChangedSignal("MenuIsOpen").Connect(() => menuOpen(GuiService.MenuIsOpen)),
		UserInputService.TextBoxFocused.Connect(() => textEditing(true)),
		UserInputService.TextBoxFocusReleased.Connect(() =>
			task.defer(() => textEditing(UserInputService.GetFocusedTextBox() !== undefined)),
		),
		UserInputService.InputBegan.Connect((input) => {
			if (input.KeyCode !== Enum.KeyCode.ButtonA || capturedA || textEditing() || menuOpen()) return;
			const object = GuiService.SelectedObject;
			const control = object && controls.get(object);
			if (!object || !control?.buttonADown || !native(control.owner)) return;
			capturedA = { object, input, control };
			control.buttonADown(input);
		}),
		UserInputService.InputBegan.Connect((input) => {
			if (input.KeyCode === Enum.KeyCode.DPadUp) selectTopbarIcon();
		}),
		UserInputService.InputEnded.Connect((input) => {
			if (input.KeyCode === Enum.KeyCode.ButtonA && capturedA?.input.UserInputType === input.UserInputType)
				cancelA();
		}),
		UserInputService.GamepadDisconnected.Connect((gamepad) => {
			if (capturedA?.input.UserInputType === gamepad) cancelA();
			armed = !host.close.held();
		}),
	];
	const stopClose = [
		host.close.onPressed(() => {
			const id = topId();
			const record = id !== undefined ? roots.get(id) : undefined;
			if (!armed || !record || record.mode !== "Native" || textEditing() || menuOpen()) return;
			armed = false;
			record.onClose?.();
		}),
		host.close.onReleased(() => {
			armed = !host.close.held();
		}),
	];
	menuOpen(GuiService.MenuIsOpen);
	textEditing(UserInputService.GetFocusedTextBox() !== undefined);
	selectionChanged();
	const [stopEffects] = root(() => {
		effect(() => {
			const id = topId();
			cancelRequest();
			cancelA();
			armed = !host.close.held();
			const old = previousTop;
			previousTop = id;
			if (id !== undefined && id !== old)
				task.defer(() => {
					if (topId() === id) dispatch(id, { kind: "Shown" });
				});
		});
		effect(() => {
			const id = topId();
			const editing = textEditing();
			const menu = menuOpen();
			armed = !host.close.held();
			if (editing || menu) {
				cancelRequest();
				cancelA();
			}
			if (id !== undefined && roots.get(id)?.mode === "Native" && !editing) {
				if (!menu && GuiService.SelectedObject === undefined)
					task.defer(() => {
						if (topId() === id) dispatch(id, { kind: "Shown" });
					});
				cleanup(host.claimMenuInput());
			}
		});
		effect(() => {
			if (host.device() !== "Gamepad") {
				cancelRequest();
				cancelA();
				return;
			}
			const id = topId();
			if (id !== undefined && GuiService.SelectedObject === undefined)
				task.defer(() => {
					if (topId() === id) dispatch(id, { kind: "Shown" });
				});
		});
	});
	stop = () => {
		disconnect(connections);
		for (const dispose of stopClose) dispose();
		stopEffects();
		cancelA();
		cancelRequest();
		disconnect(selectedWatch);
		selectedWatch = [];
		stop = undefined;
	};
}
