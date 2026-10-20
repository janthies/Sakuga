// The module state the core still keeps: the icon catalogue and the groups created without a frame.
import type { Group, Icon } from './model/figure';

export const context = { icons: [] as Icon[], newDefaultGroups: new WeakSet<Group>() };
export function setIcons(icons: Icon[]) {
	context.icons = icons;
}
