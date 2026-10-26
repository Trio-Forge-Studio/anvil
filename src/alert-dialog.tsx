import Vide from "@rbxts/vide";
import { alertDialogPolicy, type AlertDialogBinding, type AlertDialogOptions } from "./alert-dialog-state";
import { FocusScope } from "./focus-scope";

export interface AlertDialogProps extends AlertDialogOptions {
	name?: string;
	zIndex?: number;
	children: (dialog: AlertDialogBinding) => Vide.Node;
}
export function AlertDialog(props: AlertDialogProps): Vide.Node {
	const policy = alertDialogPolicy(props);
	return (
		<FocusScope trapped Name={props.name ?? "AlertDialog"} ZIndex={props.zIndex} onClose={policy.onClose}>
			{() => props.children(policy.dialog)}
		</FocusScope>
	);
}
