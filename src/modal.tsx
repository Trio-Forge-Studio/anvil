import Vide, { cleanup } from "@rbxts/vide";
import { useAtom } from "@rbxts/vide-charm";
import type { ChildFactory, Placement, Value } from "./props";
import { active, attachRoot, closeRoot, modalOpen, openRoot, ownerContext, textEditing } from "./runtime";
export { modalOpen };
export interface ModalProps extends Placement {
	selection?: "Native" | "Pointer";
	onClose?: () => void;
	size?: Value<UDim2>;
	children: ChildFactory;
}
export function Modal(props: ModalProps): Vide.Node {
	const id = openRoot(props.selection ?? "Native", props.onClose);
	cleanup(() => closeRoot(id));
	return ownerContext(id, () => (
		<frame
			Name={props.name ?? "Modal"}
			Size={props.size ?? UDim2.fromScale(1, 1)}
			Position={props.position}
			AnchorPoint={props.anchorPoint}
			LayoutOrder={props.layoutOrder}
			ZIndex={props.zIndex}
			BackgroundTransparency={1}
			SelectionGroup={true}
			SelectionBehaviorUp={Enum.SelectionBehavior.Stop}
			SelectionBehaviorDown={Enum.SelectionBehavior.Stop}
			SelectionBehaviorLeft={Enum.SelectionBehavior.Stop}
			SelectionBehaviorRight={Enum.SelectionBehavior.Stop}
			action={(root: Frame) => cleanup(attachRoot(id, root))}
		>
			{props.children()}
		</frame>
	));
}
export function useModalActive(): () => boolean {
	const owner = ownerContext();
	return useAtom(() => active(owner));
}
export function useTextEditing(): () => boolean {
	return useAtom(textEditing);
}
