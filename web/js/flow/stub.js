// Placeholder scene used until an area's real scene lands. It shows the scene name and a
// Continue button that calls the contract's callback with a default result, so the full game
// flow can be exercised end to end at every stage of development.
import { el, button, focusFirst, focusNavigator } from '../ui/dom.js';

export function stubScene(name, defaultResult = () => ({})) {
  return app => {
    let params = {}, nav;
    return {
      enter(p) {
        params = p || {};
        app.touch.hide();
        const panel = el('div', { style: { position: 'absolute', inset: '0', display: 'grid', placeContent: 'center', gap: '18px', textAlign: 'center', color: '#fdf8ec' } },
          el('div', { style: { font: '800 34px var(--ui-font)' } }, name),
          el('div', { style: { font: '400 16px var(--body-font)', opacity: '0.8' } }, 'Placeholder scene'),
          button('Continue', () => {
            const cb = params.onComplete;
            if (typeof cb === 'function') cb(defaultResult(params));
            else app.scenes.go('splash');
          }, { class: 'primary', id: `stub-${name}-continue` }));
        app.ui.append(panel);
        focusFirst(panel);
        nav = focusNavigator(panel);
      },
      update() { nav && nav(); },
      render(ctx) { ctx.fillStyle = '#231b52'; ctx.fillRect(0, 0, 800, 450); },
    };
  };
}
