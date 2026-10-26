import Vide, { read, show } from "@rbxts/vide";
import { createGroup, type Group, type Orientation } from "./group";
import { chain, hostProps, partContext, slot, type AsChildProps } from "./part";
import type { ChildFactory, Value } from "./props";
import { useTabs, type TabsBinding, type TabsOptions } from "./use-tabs";

interface TabsContext {
	tabs: TabsBinding<unknown>;
	group: Group;
	disabled?: Value<boolean>;
}
const context = partContext<TabsContext>("Tabs.Root");

export interface TabsRootProps<T> extends TabsOptions<T> {
	orientation?: Value<Orientation>;
	loop?: Value<boolean>;
	children: (tabs: TabsBinding<T>) => Vide.Node;
}
function TabsRoot<T>(props: TabsRootProps<T>): Vide.Node {
	const tabs = useTabs<T>(props);
	const group = createGroup({ orientation: props.orientation, loop: props.loop ?? true });
	return context.provide({ tabs: tabs as TabsBinding<unknown>, group, disabled: props.disabled }, () =>
		props.children(tabs),
	);
}

export type TabsListProps = AsChildProps<Frame>;
function TabsList(props: TabsListProps): Vide.Node {
	context.use("Tabs.List");
	if (props.asChild) return slot(props.children, "Tabs.List", "GuiObject", () => {});
	return (
		<frame BackgroundTransparency={1} BorderSizePixel={0} {...hostProps(props, [])} action={props.action}>
			{props.children}
		</frame>
	);
}

export type TabsTriggerProps = {
	value: unknown;
	disabled?: Value<boolean>;
	selectFirst?: Value<boolean>;
} & AsChildProps<TextButton>;
function TabsTrigger(props: TabsTriggerProps): Vide.Node {
	const { tabs, group, disabled } = context.use("Tabs.Trigger");
	const trigger = tabs.trigger(props.value, { disabled: props.disabled, selectFirst: props.selectFirst });
	const apply = (instance: GuiButton) => {
		trigger.action(instance);
		group.item(instance, () => read(disabled ?? false) || read(props.disabled ?? false));
	};
	if (props.asChild) return slot(props.children, "Tabs.Trigger", "GuiButton", apply, true);
	return (
		<textbutton
			Text=""
			AutoButtonColor={false}
			BackgroundTransparency={1}
			BorderSizePixel={0}
			{...hostProps(props, ["value", "disabled", "selectFirst"])}
			action={chain(apply, props.action)}
		>
			{props.children}
		</textbutton>
	);
}

export type TabsContentProps = { value: unknown } & AsChildProps<Frame, ChildFactory> & { children: ChildFactory };
function TabsContent(props: TabsContentProps): Vide.Node {
	const { tabs } = context.use("Tabs.Content");
	return show(
		() => tabs.value() === props.value,
		() => {
			if (props.asChild) return slot(props.children(), "Tabs.Content", "GuiObject", () => {});
			return (
				<frame
					BackgroundTransparency={1}
					BorderSizePixel={0}
					{...hostProps(props, ["value"])}
					action={props.action}
				>
					{props.children()}
				</frame>
			);
		},
	);
}

export const Tabs = { Root: TabsRoot, List: TabsList, Trigger: TabsTrigger, Content: TabsContent };
