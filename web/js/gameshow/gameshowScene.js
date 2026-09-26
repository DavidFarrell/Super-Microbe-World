// Game show quiz scene (owned by the gameshow area; see js/flow/contract.md). Placeholder until implemented.
import { stubScene } from '../flow/stub.js';
export const gameshowScene = stubScene('gameshow', p => ({ playerScore: p.playerScore || 0, cpuScore: p.cpuScore || 0, answers: [] }));
