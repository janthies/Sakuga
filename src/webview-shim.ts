// Entry of media/dist/shared.js: gives media/editor.js the three globals it still reads until S8 imports core directly.
import { routes, sketch, text } from './shared';

const root = globalThis as unknown as Record<string, unknown>;
root.SakugaText = { ...text };
root.SakugaRoutes = { ...routes };
root.SakugaSketch = { ...sketch };
