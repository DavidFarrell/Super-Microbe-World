// Placeholder splash used while the engine core is brought up; replaced by the faithful
// TV "tuning in" splash once the art pipeline lands.
import { el, button, focusFirst, focusNavigator } from '../ui/dom.js';
import { Particles } from '../core/fx.js';
import { input } from '../core/input.js';

export function splashScene(app) {
  const particles = new Particles();
  let t = 0, nav;
  return {
    enter() {
      const panel = el('div', { style: { position: 'absolute', left: '0', top: '300px', width: '800px', display: 'flex', justifyContent: 'center', gap: '16px' } },
        button('New Game', () => app.announce('New game'), { class: 'primary', id: 'btn-new-game' }));
      app.ui.append(panel);
      focusFirst(panel);
      nav = focusNavigator(panel);
      app.touch.hide();
    },
    update() {
      t++;
      nav();
      if (t % 6 === 0) particles.emit(400 + Math.sin(t / 30) * 200, 200, { count: 3, colors: ['#ff8a5c', '#5fd4ff', '#6fe0a8'], shape: 'bubble', gravity: -0.03, speed: 1.2, life: 90, size: 8 });
      particles.update();
      if (input.pressed('confirm')) document.getElementById('btn-new-game')?.click();
    },
    render(ctx) {
      ctx.fillStyle = '#231b52'; ctx.fillRect(0, 0, 800, 450);
      particles.draw(ctx);
      ctx.fillStyle = '#fdf8ec'; ctx.font = '800 54px Baloo, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Super Microbe World', 400, 180);
    },
  };
}
