import { arrangeRoutes } from '../../core/layout/arrange-routes';
import { parse } from '../../core/codec/parse';
import { src } from '../platform/dom';
import type { Op } from '../tools/types';
import type { Op as CoreOp } from '../../core/ops/types';

export const safeArrange = (plan: Op): Op => arrangeRoutes(parse(src.value), plan as CoreOp);
