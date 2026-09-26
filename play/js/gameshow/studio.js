// The game show studio: the set (gameshow_set, sprite 897), the host (gsh, 471 frames), Harry
// and Amy (their 'upper' clips, 1124 frames), the podia with the green LCD scoreboards, plus the
// port's podium name tags and eased score counters. Layout and draw order follow the SWF:
// set, host, Harry, Amy, podia, digits (GameShow.as:56-68; tools/swf-sheet/compose.mjs).
//
// Podiums belong to the children as in the art: Amy stands at the middle podium (amy_score),
// Harry at the right one (harry_score). Whoever the player chose is the player; the other child
// is the CPU opponent (NOTES 6.1, 10.2 #39; the original always made Harry the player).
import { Clip, drawFrame, hasArt, track, mul, frameOfTick } from './art.js';
import { BALOO, roundRect, fitLine, textWidth } from './text.js';
import { MAX_SCORE } from './rules.js';

// A label with no art in the atlas falls back (checked at play time). 'condifent' and 'curious'
// are in the rig render now (tools/swf-sheet/jobs/gameshow.json), so these only guard against an
// atlas built without them; 'confident' is the label GameShow.as:227 asks for (NOTES 10.2 #43).
const KID_FALLBACKS = { condifent: 'cautious', curious: 'neutral', confident: 'condifent' };
const SCORE_KEYS = { amy: 'amy_score', harry: 'harry_score' };
// LCD face of the score clip (gs_score, 73 x 32.5 in its own units), in score-clip space.
const LCD = { w: 73, h: 32.5 };
const DIGITS = ['thousands', 'hundreds', 'tens', 'units'];
// Name tags: 15 px, shrinking to 13 px (11 CSS px or more on a 667 px wide phone), then cut with
// an ellipsis. 112 px of text keeps two long tags (their centres are 136 px apart) apart; the
// talkie and the results card show the whole name.
const TAG = { maxWidth: 112, size: 15, min: 13 };
const tagFont = s => `800 ${s}px ${BALOO}`;
export function tagFit(name) {
  const f = fitLine(name, tagFont, TAG.maxWidth, TAG.size, TAG.min);
  if (f.fits) return { ...f, text: name };
  const chars = [...name];
  for (let n = chars.length - 1; n > 0; n--) {
    const text = chars.slice(0, n).join('').trimEnd() + '\u2026';
    const w = textWidth(text, tagFont(TAG.min));
    if (w <= TAG.maxWidth) return { size: TAG.min, width: w, fits: true, text, truncated: true };
  }
  return { size: TAG.min, width: textWidth('\u2026', tagFont(TAG.min)), fits: true, text: '\u2026', truncated: true };
}
// Fallback placements while the atlas is missing (from gs_podia tracks).
const FALLBACK_SCORE_M = { amy: [0.78131, 0.09801, 0, 0.78123, 465.33, 274], harry: [0.94544, 0.1187, 0, 0.94624, 596.14, 289.45] };
const FALLBACK_DIGIT_X = [7.6, 22.5, 37.4, 52.3];

export class Studio {
  constructor({ player, playerName, cpuName }) {
    this.player = player === 'amy' ? 'amy' : 'harry';
    this.cpu = this.player === 'amy' ? 'harry' : 'amy';
    this.names = { [this.player]: playerName, [this.cpu]: cpuName };
    this.host = new Clip('gs_host');
    this.kids = { harry: new Clip('gs_harry', { fallbacks: KID_FALLBACKS }), amy: new Clip('gs_amy', { fallbacks: KID_FALLBACKS }) };
    this.scores = { harry: { value: 0, shown: 0, glow: 0 }, amy: { value: 0, shown: 0, glow: 0 } };
    this.tagPop = { harry: 0, amy: 0 };
    this.tick = 0;
    this.frame = 0;
    this.onDigit = null;   // callback(who) when a counter ticks over (sound)
  }

  // Starts the timelines: the host stands at 'stop' (frame 1) until the show begins; the children
  // idle (the original children stood at frame 1; their authored idle loop is used instead).
  start() {
    this.host.stopAt('stop');
    this.kids.harry.play('idle');
    this.kids.amy.play('idle');
  }

  setScores(player, cpu, { instant = false } = {}) {
    const set = (who, v) => {
      const s = this.scores[who];
      v = Math.max(0, Math.min(MAX_SCORE, v | 0));
      if (v !== s.value) s.glow = 1;
      s.value = v;
      if (instant) s.shown = v;
    };
    set(this.player, player);
    set(this.cpu, cpu);
  }

  react(who, label) {
    if (who === 'host') this.host.play(label);
    else this.kids[who].play(label);
  }

  // Per 15 ms tick.
  update() {
    this.tick++;
    const f = frameOfTick(this.tick);
    while (this.frame < f) {
      this.frame++;
      this.host.advance();
      this.kids.harry.advance();
      this.kids.amy.advance();
    }
    for (const who of ['harry', 'amy']) {
      const s = this.scores[who];
      s.glow = Math.max(0, s.glow - 0.02);
      if (s.shown !== s.value && this.tick % 2 === 0) {
        const d = s.value - s.shown;
        const step = Math.sign(d) * Math.max(1, Math.round(Math.abs(d) * 0.18));
        s.shown += step;
        if (this.onDigit) this.onDigit(who);
      }
      this.tagPop[who] = Math.max(0, this.tagPop[who] - 0.04);
    }
  }

  get countersSettled() { return this.scores.harry.shown === this.scores.harry.value && this.scores.amy.shown === this.scores.amy.value; }

  // Stage matrix of a podium's score clip.
  scoreMatrix(who) { return track('gs_podia', SCORE_KEYS[who]) || FALLBACK_SCORE_M[who]; }

  // Centre of a scoreboard's LCD on the stage (for particles and popups).
  scoreCentre(who) {
    const m = this.scoreMatrix(who);
    const cx = LCD.w / 2, cy = LCD.h / 2;
    return { x: m[0] * cx + m[2] * cy + m[4], y: m[1] * cx + m[3] * cy + m[5] };
  }

  // Where each child's head is, roughly (for reaction particles).
  kidAnchor(who) { return who === 'amy' ? { x: 508, y: 200 } : { x: 640, y: 212 } }

  draw(ctx, { reducedMotion = false } = {}) {
    if (!hasArt('gs_set')) { this.drawFallback(ctx); return; }
    drawFrame(ctx, 'gs_set', 1);
    this.host.draw(ctx);
    this.kids.harry.draw(ctx);
    this.kids.amy.draw(ctx);
    drawFrame(ctx, 'gs_podia', 1);
    this.drawPodiumBadge(ctx);
    for (const who of ['amy', 'harry']) this.drawScore(ctx, who);
    for (const who of ['amy', 'harry']) this.drawTag(ctx, who, reducedMotion);
  }

  drawScore(ctx, who) {
    const s = this.scores[who];
    const m = this.scoreMatrix(who);
    const digits = String(Math.max(0, Math.min(MAX_SCORE, s.shown))).padStart(4, '0').split('').map(Number);
    DIGITS.forEach((d, i) => {
      const dm = track('gs_score', d) || [1.1236, 0, 0, 1.12355, FALLBACK_DIGIT_X[i], 6.2];
      if (!drawFrame(ctx, 'gs_digit', digits[i] ? digits[i] * 10 : 1, mul(m, dm))) {
        ctx.save();
        const mm = mul(m, dm);
        ctx.transform(mm[0], mm[1], mm[2], mm[3], mm[4], mm[5]);
        ctx.fillStyle = '#61d346';
        ctx.font = '700 17px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText(String(digits[i]), 1, 0);
        ctx.restore();
      }
    });
    // A soft green glow while the counter changes.
    if (s.glow > 0.01) {
      ctx.save();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(97, 211, 70, ${0.35 * s.glow})`;
      roundRect(ctx, 2, 2, LCD.w - 4, LCD.h - 4, 4);
      ctx.fill();
      ctx.restore();
    }
  }

  // Name tag on the front rim of each podium, just above its scoreboard (the podium fronts below
  // the scoreboards are hidden by the talkie). The player's tag is gold.
  drawTag(ctx, who, reducedMotion) {
    const m = this.scoreMatrix(who);
    const name = this.names[who] || '';
    if (!name) return;
    const isPlayer = who === this.player;
    const cx = m[0] * (LCD.w / 2) + m[4];
    const lcdTop = m[1] * (LCD.w / 2) + m[5];
    this._tagFits ||= new Map();
    let f = this._tagFits.get(name);
    if (!f) { f = tagFit(name); this._tagFits.set(name, f); }
    const w = Math.max(48, f.width + 22), h = 21;
    const pop = reducedMotion ? 0 : this.tagPop[who];
    ctx.save();
    ctx.translate(cx, lcdTop - 13);
    ctx.scale(1 + pop * 0.25, 1 + pop * 0.25);
    ctx.fillStyle = 'rgba(60, 10, 70, 0.3)';
    roundRect(ctx, -w / 2, -h / 2 + 2.5, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = isPlayer ? '#ffd84a' : '#fdf8ec';
    ctx.strokeStyle = isPlayer ? '#b57a00' : '#8a5aa8';
    ctx.lineWidth = 2;
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a1450';
    ctx.font = `800 ${f.size}px ${BALOO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, 0, 1.5);
    ctx.restore();
  }

  // The original host podium carried the e-Bug smiley (a round emblem about 50 px across). The
  // art now has it erased (NOTES 11.2, web/NOTES-art-decisions.md 6); a quiz-show "?" medallion
  // of the same size keeps a bright emblem in that spot. Also drawn by the flow's cutscene and
  // ending (Studio is shared).
  drawPodiumBadge(ctx) {
    const x = 254, y = 314, r = 23;
    ctx.save();
    ctx.fillStyle = 'rgba(60, 10, 70, 0.28)';
    ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - 7, y - 9, 2, x, y, r);
    g.addColorStop(0, '#fff3a6');
    g.addColorStop(1, '#ffc93a');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#7a2f99';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r - 5, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.fillStyle = '#7a2f99';
    ctx.font = `800 32px ${BALOO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y + 3);
    ctx.restore();
  }

  drawFallback(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 450);
    g.addColorStop(0, '#9cc6e4');
    g.addColorStop(0.7, '#7fb0d6');
    g.addColorStop(1, '#3a3a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 800, 450);
    const podium = (x, y, w, h, top) => {
      ctx.fillStyle = '#b059d1'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = top; ctx.fillRect(x - 8, y - 12, w + 16, 16);
    };
    podium(180, 260, 110, 120, '#ffa6d0');
    podium(460, 265, 100, 110, '#ffa6d0');
    podium(590, 280, 100, 110, '#ffa6d0');
    for (const who of ['amy', 'harry']) this.drawScore(ctx, who);
    for (const who of ['amy', 'harry']) this.drawTag(ctx, who, true);
  }

  // Plain snapshot for probes.
  state() {
    return {
      host: this.host.label, harry: this.kids.harry.label, amy: this.kids.amy.label,
      hostFrame: this.host.frame, harryFrame: this.kids.harry.frame, amyFrame: this.kids.amy.frame,
      scores: { harry: { ...this.scores.harry }, amy: { ...this.scores.amy } },
      tags: Object.fromEntries(Object.entries(this.names).map(([who, n]) => {
        const f = n ? tagFit(n) : null;
        return [who, f && { text: f.text, size: f.size, width: f.width, truncated: !!f.truncated }];
      })),
    };
  }
}
