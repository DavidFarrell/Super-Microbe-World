// Turns the engine's per-tick input (15 ms ticks) into one input snapshot per 30 ms logic step.
// Presses and releases are latched across both ticks so none are lost, and an action counts as
// held if it was down on either tick. Pure: takes any object with isDown/pressed/released.
//
// Fire and camera repeat while held, like the original's keyboard auto-repeat: Flash set
// fire_down / alt_fire_down from key-down events, which the OS repeats (about 500 ms delay, then
// roughly 30 per second); the player's own animation state limits the actual rate of shots.
export const REPEAT_DELAY_STEPS = 17;   // ~510 ms
export const REPEAT_EVERY_STEPS = 2;    // ~60 ms

const ACTIONS = ['left', 'right', 'jump', 'fire', 'camera'];

export class StepInput {
  constructor({ repeat = true } = {}) {
    this.repeat = repeat;
    this.held = { fire: 0, camera: 0 };
    this._reset();
  }

  _reset() {
    this.down = Object.fromEntries(ACTIONS.map(a => [a, false]));
    this.pressed = Object.fromEntries(ACTIONS.map(a => [a, false]));
    this.released = Object.fromEntries(ACTIONS.map(a => [a, false]));
    this.lastDown = this.lastDown || Object.fromEntries(ACTIONS.map(a => [a, false]));
  }

  // Call once per engine tick, after input.poll().
  latch(src) {
    for (const a of ACTIONS) {
      const d = src.isDown(a);
      if (d) this.down[a] = true;
      if (src.pressed(a)) this.pressed[a] = true;
      if (src.released(a)) this.released[a] = true;
      this.lastDown[a] = d;
    }
  }

  // Call once per logic step; returns the snapshot the game's player reads.
  take() {
    const d = this.down, p = this.pressed;
    const rep = a => {
      const heldNow = this.lastDown[a];
      this.held[a] = heldNow ? this.held[a] + 1 : 0;
      if (p[a]) { this.held[a] = heldNow ? 1 : 0; return true; }
      if (!this.repeat || !heldNow) return false;
      const n = this.held[a] - 1 - REPEAT_DELAY_STEPS;
      return n >= 0 && n % REPEAT_EVERY_STEPS === 0;
    };
    const snap = {
      left: d.left || p.left,
      right: d.right || p.right,
      jumpHeld: d.jump,
      jumpPressed: p.jump,
      jumpReleased: this.released.jump && !this.lastDown.jump,
      firePressed: rep('fire'),
      cameraPressed: rep('camera'),
    };
    this._reset();
    return snap;
  }

  clear() {
    this.lastDown = null;
    this.held = { fire: 0, camera: 0 };
    this._reset();
  }
}
