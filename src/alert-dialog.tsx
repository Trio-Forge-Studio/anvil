import type Vide from "@rbxts/vide";
import { alertDialogPolicy, type AlertDialogBinding, type AlertDialogOptions } from "./alert-dialog-state";
import { Modal } from "./modal";
import type { Placement } from "./props";

export interface AlertDialogProps extends AlertDialogOptions, Pick<Placement, "name" | "zIndex"> {
	children: (dialog: AlertDialogBinding) => Vide.Node;
}
export function AlertDialog(props: AlertDialogProps): Vide.Node {
	const policy = alertDialogPolicy(props);
	return Modal({
		name: props.name ?? "AlertDialog",
		zIndex: props.zIndex,
		onClose: policy.onClose,
		children: () => props.children(policy.dialog),
	});
}
