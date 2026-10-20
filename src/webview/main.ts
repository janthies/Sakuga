import { initTextEditing } from './ui/textediting';
import { initCanvasMenus } from './ui/canvas-menu';
import { appState } from './commands/state';
import { runCommand } from './commands/registry';
import { PROTOCOL } from '../bridge/protocol';
import { vscode } from './platform/host';
import { initPlatformHost } from './platform/host';
import { initUiFloating } from './ui/floating';
import { initDispatch } from './tools/live/dispatch';
import { initKeyboard } from './commands/keyboard';
import { initToolbar } from './commands/toolbar';
import { initCommandsMessages } from './commands/messages';
import { initPanelsLayers } from './panels/layers';
import { initPanelsChrome } from './panels/chrome';
import { initTestHook } from './testHook';
import './panels/zoombar';
import './panels/inspector';

initPlatformHost();
initUiFloating();
initTextEditing();
initCanvasMenus((id, args) => runCommand(appState, id, args));
initDispatch();
initKeyboard();
initToolbar();
initCommandsMessages();
initPanelsLayers();
initPanelsChrome();
initTestHook();
Promise.all([document.fonts.load(`12px 'Sakuga Sans'`), document.fonts.load(`12px 'Sakuga Mono'`)]).finally(() =>
	vscode.postMessage({ type: 'ready', protocol: PROTOCOL }),
);
