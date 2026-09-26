// A minimal model of a Flash MovieClip timeline, enough to reproduce the game logic that reads
// the clip's frame-script variables (midAnimation, shoot, finished) and to tell the renderer
// which label and frame to draw. Timelines advance at 25 fps on a global frame clock, which the
// game converts from its 30 ms logic steps (so animation timings match the original in ms).
//
// Frame-script semantics (flash-platformer.md section 11 notes these are only certain to within
// one tick):
// - Creating a clip runs its frame-1 script immediately (attachMovie initialises frame 1).
// - gotoAndPlay/gotoAndStop move the playhead at once but queue the destination frame's script;
//   a second goto before the queue is flushed replaces it ("last goto wins"). Reading a script
//   variable or ticking flushes the queue. This makes Slurm's be_hit -> be_killed sequence end
//   immediately, as the spec records (section 4.5), while single gotos behave as immediate.
// - A goto to the frame the playhead is already on does not re-run its script.
// - A goto to a label the clip does not have is ignored (e.g. Steve's "steve_idle").
import { CLIPS } from './data/clips.js';

const EMPTY = { frameCount: 1, labels: {}, scripts: {}, bounds: null };

export class Clip {
  constructor(symbol) {
    this.symbol = symbol;
    this.def = CLIPS[symbol] || EMPTY;
    this.frame = 1;
    this.playing = true;
    this.vars = {};
    this.alpha = 100;
    this.visible = true;
    this.removed = false;
    this._pending = null;
    this._labelFrames = Object.entries(this.def.labels).sort((a, b) => a[1] - b[1]);
    this._run(1);
    this._flush();
  }

  get midAnimation() { this._flush(); return this.vars.midAnimation; }
  set midAnimation(v) { this._flush(); this.vars.midAnimation = v; }
  get shoot() { this._flush(); return this.vars.shoot; }
  set shoot(v) { this._flush(); this.vars.shoot = v; }
  get lives() { return this.vars.lives; }
  set lives(v) { this.vars.lives = v; }

  hasLabel(label) { return label in this.def.labels; }

  gotoAndPlay(label) { this._goto(label, true); }
  gotoAndStop(label) { this._goto(label, false); }
  stop() { this._flush(); this.playing = false; }
  play() { this._flush(); this.playing = true; }

  // Advances one 25 fps frame.
  tick() {
    this._flush();
    if (!this.playing || this.removed) return;
    this.frame = this.frame >= this.def.frameCount ? 1 : this.frame + 1;
    this._run(this.frame);
    this._flush();
  }

  // Current label (the last label at or before the playhead) and frames since it, for drawing.
  get label() {
    let name = null;
    for (const [n, f] of this._labelFrames) { if (f <= this.frame) name = n; else break; }
    return name;
  }
  get labelFrame() {
    const l = this.label;
    return l ? this.frame - this.def.labels[l] : this.frame - 1;
  }

  _goto(label, play) {
    const f = this.def.labels[label];
    if (f === undefined) return;
    this.playing = play;
    if (f === this.frame && this._pending === null) return;
    this.frame = f;
    this._pending = f;
  }

  _flush() {
    for (let guard = 0; this._pending !== null && guard < 16; guard++) {
      const f = this._pending;
      this._pending = null;
      this._run(f);
    }
  }

  _run(frame) {
    const ops = this.def.scripts[frame];
    if (ops) this._exec(ops);
  }

  _exec(ops) {
    for (const op of ops) {
      switch (op[0]) {
        case 'set':
          if (op[1] === 'visible') this.visible = op[2];
          else this.vars[op[1]] = op[2];
          break;
        case 'goto': this._goto(op[1], op[2]); break;
        case 'stop': this.playing = false; break;
        case 'play': this.playing = true; break;
        case 'if': this._exec(this.vars[op[1]] ? op[2] : op[3]); break;
        default: break;
      }
    }
  }
}
