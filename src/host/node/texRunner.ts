import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import type { TexJob, TexResult, TexRunner } from '../ports';

const run = promisify(execFile);

// LuaLaTeX plus pdftocairo through child processes. It lives in host/node, not host/vscode, because it needs Node only:
// the same runner serves tests and a future CLI. Fails with the first '!' line of the TeX log and keeps the work folder then.
export const nodeTexRunner: TexRunner = {
	async run(job: TexJob): Promise<TexResult> {
		if (job.output === 'svg-dvisvgm') {
			return { ok: false, error: 'dvisvgm output is not implemented', log: '' };
		}
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sakuga-'));
		await fs.writeFile(path.join(dir, 'fig.tex'), job.tex);
		try {
			await run('nice', ['-n', '19', 'lualatex', '-interaction=nonstopmode', '-halt-on-error', 'fig.tex'], {
				cwd: dir,
				timeout: job.timeoutMs,
			});
		} catch {
			const out = await fs.readFile(path.join(dir, 'fig.log'), 'utf8').catch(() => '');
			const error = out.split('\n').find((l) => l.startsWith('!')) ?? 'LuaLaTeX failed';
			return { ok: false, error, log: `files in ${dir}` };
		}
		try {
			if (job.output === 'svg-pdftocairo') {
				await run('pdftocairo', ['-svg', 'fig.pdf', 'fig.svg'], { cwd: dir });
			}
			const file = await fs.readFile(path.join(dir, job.output === 'pdf' ? 'fig.pdf' : 'fig.svg'));
			await fs.rm(dir, { recursive: true, force: true });
			return { ok: true, file };
		} catch (e) {
			return { ok: false, error: `pdftocairo failed: ${(e as Error).message}`, log: `files in ${dir}` };
		}
	},
};
