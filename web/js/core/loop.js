// Fixed-timestep game loop.
// The 2009 original called PlatformGame.main() from setInterval(loop, 15), so the
// simulation advances in 15 ms ticks here too. Rendering runs at display rate and
// receives an interpolation factor so motion stays smooth on 60/120 Hz screens.

export const TICK_MS = 15;
const MAX_CATCH_UP_TICKS = 8; // avoid a spiral of death after a long stall

export class Loop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.tick = 0;
    this.accumulator = 0;
    this.last = 0;
    this.running = false;
    this.paused = false;
    this.manual = false; // tests drive ticks explicitly via step()
    this.timeScale = 1;
    this._raf = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  setPaused(paused) {
    this.paused = paused;
    this.last = performance.now();
    this.accumulator = 0;
  }

  // Advance the simulation by n ticks synchronously (used by tests and bots).
  step(n = 1) {
    for (let i = 0; i < n; i++) this._tick();
    this.render(0);
  }

  _tick() {
    this.update(this.tick);
    this.tick++;
  }

  _frame(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._frame);
    const elapsed = Math.min(250, now - this.last);
    this.last = now;
    if (!this.paused && !this.manual) {
      this.accumulator += elapsed * this.timeScale;
      let n = 0;
      while (this.accumulator >= TICK_MS && n < MAX_CATCH_UP_TICKS) {
        this._tick();
        this.accumulator -= TICK_MS;
        n++;
      }
      if (n === MAX_CATCH_UP_TICKS) this.accumulator = 0;
    }
    this.render(this.manual || this.paused ? 0 : this.accumulator / TICK_MS);
  }
}
