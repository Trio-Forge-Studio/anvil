export interface DialogAction {
	onPress: () => void;
	selectFirst: boolean;
}
export interface AlertDialogBinding {
	confirm: DialogAction;
	cancel?: DialogAction;
}
export interface AlertDialogOptions {
	onConfirm: () => void;
	onCancel?: () => void;
	onClose?: () => void;
	destructive?: boolean;
}
export function alertDialogPolicy(options: AlertDialogOptions): {
	dialog: AlertDialogBinding;
	onClose?: () => void;
} {
	const cancelFirst = options.destructive === true && options.onCancel !== undefined;
	return {
		dialog: {
			confirm: { onPress: options.onConfirm, selectFirst: !cancelFirst },
			cancel:
				options.onCancel !== undefined ? { onPress: options.onCancel, selectFirst: cancelFirst } : undefined,
		},
		onClose: options.onCancel ?? options.onClose,
	};
}
