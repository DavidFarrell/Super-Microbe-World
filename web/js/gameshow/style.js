// Styles for the game show's DOM layer (injected once; every class is prefixed gs-).
import { el } from '../ui/dom.js';

const CSS = `
.gs-board { position: absolute; inset: 0; z-index: 3; }
.gs-board[hidden] { display: none; }
.gs-answer {
  position: absolute; margin: 0; padding: 0; border: 0; background: transparent; cursor: pointer;
  border-radius: 18px; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.gs-answer:focus { outline: none; }
.gs-answer:focus-visible { outline: 4px solid #ffd84a; outline-offset: 3px; }
.gs-answer[disabled] { cursor: default; }
.gs-pause {
  position: absolute; left: 8px; top: 8px; z-index: 5; padding: 0; width: 48px; height: 48px;
  border-radius: 14px; display: grid; place-items: center; color: #fff;
  background: rgba(27, 22, 64, 0.6); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}
.gs-pause:hover { background: rgba(27, 22, 64, 0.8); }
.gs-pause svg { width: 26px; height: 26px; }
.gs-stage-tap { position: absolute; inset: 0; z-index: 2; cursor: pointer; }
.gs-stage-tap[hidden] { display: none; }
.gs-overlay { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; background: rgba(20, 14, 50, 0.55); }
.gs-card {
  width: 520px; max-width: 92%; background: var(--panel, #2c2466); color: var(--ink, #fdf8ec);
  border-radius: 26px; padding: 22px 26px 20px; text-align: center; box-shadow: 0 10px 0 rgba(0, 0, 0, 0.3);
  border: 4px solid rgba(255, 255, 255, 0.15); animation: gs-card-in 0.35s cubic-bezier(.2, 1.4, .4, 1) both;
}
.gs-card h2 { margin: 0 0 10px; font: 800 34px/1.1 var(--ui-font); }
.gs-card p { margin: 6px 0 14px; font: 400 19px/1.35 var(--body-font); }
.gs-card .gs-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 10px; }
.gs-scores { display: flex; gap: 12px; justify-content: center; margin: 6px 0 12px; }
.gs-score { background: rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 8px 16px 6px; min-width: 120px; }
.gs-score b { display: block; font: 800 32px/1.1 var(--ui-font); color: #61d346; }
.gs-score span { font: 400 15px/1.2 var(--body-font); opacity: 0.9; }
.gs-score.you b { color: #ffd84a; }
@keyframes gs-card-in { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .gs-card { animation: none; } }
`;

export function injectStyle() {
  if (document.getElementById('gs-scene-style')) return;
  document.head.append(el('style', { id: 'gs-scene-style' }, CSS));
}

export const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M9 6v12M15 6v12"/></svg>';
