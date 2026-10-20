// @ts-nocheck
import { store } from './store';
import { vscode } from '../platform/host';

export const saveState = () =>
	vscode.setState({ ...vscode.getState(), grid: store.grid, recentColors: store.recentColors });
export const persist = (o) => vscode.setState({ ...vscode.getState(), ...o });
