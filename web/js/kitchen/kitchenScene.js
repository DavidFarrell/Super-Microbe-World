// Kitchen game scene (owned by the kitchen area; see js/flow/contract.md). Placeholder until implemented.
import { stubScene } from '../flow/stub.js';
export const kitchenScene = stubScene('kitchen', p => ({ level: p.level || 0, score: p.score || 0, report: [] }));
