import Vide, { show } from "@rbxts/vide";
import { useFocusScope } from "./focus-scope";
import { buttonHost, frameHost, partContext, type AsChildProps, type ButtonPartProps, type PartContext } from "./part";
import type { ChildFactory, Value } from "./props";
import { closeFallbackContext, ownerContext } from "./runtime";
import { useControllable } from "./use-controllable";
import { usePress, type PressBinding } from "./use-press";

export interface DialogBinding {
	open: () => boolean;
	setOpen: (open: boolean) => void;
}
interface DialogContext extends DialogBinding {
	destructive: boolean;
}
const dialogContext = partContext<DialogContext>("Dialog.Root");
const alertContext = partContext<DialogContext>("AlertDialog.Root");

export interface DialogRootProps {
	open?: Value<boolean>;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: (dialog: DialogBinding) => Vide.Node;
}
function root(context: PartContext<DialogContext>, props: DialogRootProps, destructive: boolean): Vide.Node {
	const [open, setOpen] = useControllable({
		value: props.open,
		defaultValue: props.defaultOpen ?? false,
		onChange: props.onOpenChange,
	});
	const dialog = { open, setOpen };
	return context.provide({ ...dialog, destructive }, () => props.children(dialog));
}

export type DialogContentProps = {
	selection?: "Native" | "Pointer";
	restoreFocus?: boolean;
} & AsChildProps<Frame, ChildFactory> & { children: ChildFactory };
function content(dialog: DialogContext, props: DialogContentProps, part: string): Vide.Node {
	return show(dialog.open, () => {
		const scope = useFocusScope({
			trapped: true,
			selection: props.selection,
			restoreFocus: props.restoreFocus,
			onClose: () => dialog.setOpen(false),
		});
		return ownerContext(scope.owner, () =>
			frameHost(props, part, ["selection", "restoreFocus"], () => props.children(), scope.root, {
				Size: UDim2.fromScale(1, 1),
			}),
		);
	});
}

export type DialogButtonProps = { disabled?: Value<boolean> } & ButtonPartProps<PressBinding>;
export type DialogTriggerProps = DialogButtonProps & { selectFirst?: Value<boolean> };
function DialogTrigger(props: DialogTriggerProps): Vide.Node {
	const dialog = dialogContext.use("Dialog.Trigger");
	const press = usePress({
		onPress: () => dialog.setOpen(true),
		disabled: props.disabled,
		selectFirst: props.selectFirst,
	});
	return buttonHost(props, "Dialog.Trigger", ["disabled", "selectFirst"], press.action, press);
}

// Close buttons are the scope's fallback selection when nothing else is selectable.
function closeButton(
	props: DialogButtonProps & { onPress?: () => boolean | void },
	part: string,
	dialog: DialogContext,
	selectFirst: boolean,
): Vide.Node {
	let press!: PressBinding;
	closeFallbackContext(true, () => {
		press = usePress({
			onPress: () => {
				if (props.onPress?.() === false) return false;
				dialog.setOpen(false);
			},
			disabled: props.disabled,
			selectFirst,
		});
	});
	return buttonHost(props, part, ["disabled", "onPress"], press.action, press);
}
function DialogClose(props: DialogButtonProps): Vide.Node {
	return closeButton(props, "Dialog.Close", dialogContext.use("Dialog.Close"), false);
}

export const Dialog = {
	Root: (props: DialogRootProps) => root(dialogContext, props, false),
	Trigger: DialogTrigger,
	Content: (props: DialogContentProps) => content(dialogContext.use("Dialog.Content"), props, "Dialog.Content"),
	Close: DialogClose,
};

export interface AlertDialogRootProps extends DialogRootProps {
	destructive?: boolean;
}
export type AlertDialogButtonProps = DialogButtonProps & { onPress?: () => boolean | void };
function AlertDialogAction(props: AlertDialogButtonProps): Vide.Node {
	const dialog = alertContext.use("AlertDialog.Action");
	const press = usePress({
		onPress: () => {
			if (props.onPress?.() === false) return false;
			dialog.setOpen(false);
		},
		disabled: props.disabled,
		selectFirst: !dialog.destructive,
	});
	return buttonHost(props, "AlertDialog.Action", ["disabled", "onPress"], press.action, press);
}
function AlertDialogCancel(props: AlertDialogButtonProps): Vide.Node {
	const dialog = alertContext.use("AlertDialog.Cancel");
	return closeButton(props, "AlertDialog.Cancel", dialog, dialog.destructive);
}

export const AlertDialog = {
	Root: (props: AlertDialogRootProps) => root(alertContext, props, props.destructive ?? false),
	Content: (props: DialogContentProps) =>
		content(alertContext.use("AlertDialog.Content"), props, "AlertDialog.Content"),
	Action: AlertDialogAction,
	Cancel: AlertDialogCancel,
};
