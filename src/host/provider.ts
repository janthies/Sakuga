import { compatible, PROTOCOL, ToHost, ToWebview } from '../bridge/protocol';
import { viewModel } from '../core/view/viewModel';
import { parse } from '../core/codec/parse';
import { serialize } from '../core/codec/serialize';
import { TEMPLATE } from '../core/codec/template';
import type { Icon } from '../core/model/figure';
import { apply } from '../core/ops/apply';
import { pasteOps } from '../core/ops/paste';
import type { Op } from '../core/ops/types';
import { writeDocument } from './documentSync';
import { exportSvg, ExportDeps } from './exportService';
import type { ClipboardPort, Disposable, DocumentPort, UiPort, WebviewPort } from './ports';

export interface SessionDeps extends ExportDeps {
	doc: DocumentPort;
	view: WebviewPort;
	clipboard: ClipboardPort;
	ui: UiPort;
	icons: Icon[];
}

// One open figure: sends the state of the document to the webview, applies the webview's ops and writes the result back.
// Knows nothing of VS Code; every effect goes through a port.
export function openFigure(deps: SessionDeps): Disposable {
	const { doc, view, clipboard, ui } = deps;
	const send = (message: ToWebview<Icon>) => view.post(message);
	const sendState = () => send(viewModel(doc.text()));
	const edit = (change: (fig: ReturnType<typeof parse>) => void) => {
		const fig = parse(doc.text());
		change(fig);
		return writeDocument(doc, serialize(fig));
	};

	const handle = async (msg: ToHost<Op>) => {
		switch (msg.type) {
			case 'ready':
				if (!compatible(msg)) {
					ui.error(
						`Sakuga: the editor page speaks protocol ${msg.protocol}, the extension ${PROTOCOL}. Reload the window.`,
					);
					break;
				}
				send({ type: 'icons', icons: deps.icons });
				sendState();
				break;
			case 'op':
				await edit((fig) => apply(fig, msg.op));
				break;
			case 'error':
				ui.log(`webview: ${msg.text}`);
				break;
			case 'exportSvg':
				await exportSvg(deps, doc, serialize(parse(doc.text())));
				break;
			case 'copyText':
				await clipboard.writeText(msg.text);
				ui.status('Sakuga: preamble copied', 2000);
				break;
			case 'copy':
				await clipboard.writeText(serialize(parse(doc.text())));
				ui.status('Sakuga: TikZ copied', 2000);
				break;
			case 'text':
				await writeDocument(doc, msg.text);
				break;
			case 'paste': {
				const fig = parse(doc.text());
				const { ops, ids } = pasteOps(fig, msg.text, msg.dx, msg.dy);
				if (ids.length) {
					apply(fig, { op: 'batch', ops: ops.map((op) => (op.op === 'addNode' ? { ...op, layer: msg.layer } : op)) });
					await writeDocument(doc, serialize(fig));
					send({ type: 'select', ids });
				}
				break;
			}
		}
	};

	const subscriptions = [doc.onChange(sendState), view.onMessage((m) => void handle(m as ToHost<Op>))];
	if (doc.text().trim() === '') {
		void writeDocument(doc, serialize(parse(TEMPLATE)));
	}
	return { dispose: () => subscriptions.forEach((s) => s.dispose()) };
}
