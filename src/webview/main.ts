// @ts-nocheck
import { PROTOCOL } from '../bridge/protocol';
import { vscode } from './platform/host';
import { initPlatformHost } from './platform/host';
import { initUiFloating } from './ui/floating';
import { initCommandsGroups } from './commands/groups';
import { initToolsEdit } from './tools/edit';
import { initToolsTidy } from './tools/tidy';
import { initToolsPointerdown } from './tools/pointerdown';
import { initToolsPointermove } from './tools/pointermove';
import { initToolsPointerup } from './tools/pointerup';
import { initToolsCanvas } from './tools/canvas';
import { initCommandsKeys } from './commands/keys';
import { initCommandsToolbar } from './commands/toolbar';
import { initCommandsMessages } from './commands/messages';
import { initPanelsLayers } from './panels/layers';
import { initPanelsChrome } from './panels/chrome';
import { initTestHook } from './testHook';
import './panels/zoombar';
import './panels/inspector';

initPlatformHost();
initUiFloating();
initCommandsGroups();
initToolsEdit();
initToolsTidy();
initToolsPointerdown();
initToolsPointermove();
initToolsPointerup();
initToolsCanvas();
initCommandsKeys();
initCommandsToolbar();
initCommandsMessages();
initPanelsLayers();
initPanelsChrome();
initTestHook();
Promise.all([document.fonts.load(`12px 'Sakuga Sans'`), document.fonts.load(`12px 'Sakuga Mono'`)]).finally(() =>
	vscode.postMessage({ type: 'ready', protocol: PROTOCOL }),
);
