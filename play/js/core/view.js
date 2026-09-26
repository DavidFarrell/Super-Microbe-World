// Stage scaling. The original Flash stage is 800x450 (16:9); everything is authored in
// those logical units and letterboxed to fit any screen, respecting safe-area insets.
export const STAGE_W = 800;
export const STAGE_H = 450;

// Canvas backing store: device pixels, capped at 2x (the atlases are drawn at 2x, so more only
// costs fill rate), and lowered by the governor below while rendering is slow.
const DPR_CAP = 2;
const QUALITY_STEPS = [1, 0.85, 0.7, 0.55];
const SLOW_MS = 12;          // rolling render time that counts as slow
const FAST_MS = 5;           // and as comfortably fast
const SETTLE_FRAMES = 90;    // frames between quality changes

export class View {
  constructor(root, canvas, ui) {
    this.root = root;
    this.canvas = canvas;
    this.ui = ui;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.scale = 1;
    this.dpr = 1;
    this.quality = 0;          // index into QUALITY_STEPS
    this.renderMs = 0;         // exponential moving average of render time
    this.sinceChange = 0;
    this._resizePending = false;
    this.resize = this.resize.bind(this);
    new ResizeObserver(this.resize).observe(root);
    addEventListener('orientationchange', () => setTimeout(this.resize, 250));
    this.resize();
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    const scale = Math.min(r.width / STAGE_W, r.height / STAGE_H) || 1;
    const w = Math.floor(STAGE_W * scale), h = Math.floor(STAGE_H * scale);
    const left = Math.floor((r.width - w) / 2), top = Math.floor((r.height - h) / 2);
    this.scale = scale;
    this.dpr = this._dprFor(this.quality);
    Object.assign(this.canvas.style, { width: w + 'px', height: h + 'px', left: left + 'px', top: top + 'px' });
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    // The DOM UI layer is authored at 800x450 and scaled as a whole, so text stays crisp.
    // --stage-scale lets CSS keep tap targets at least 44 CSS px however small the stage gets.
    Object.assign(this.ui.style, { left: left + 'px', top: top + 'px', transform: `scale(${w / STAGE_W})` });
    document.documentElement.style.setProperty('--stage-scale', String(w / STAGE_W));
    this.rect = { left: r.left + left, top: r.top + top, width: w, height: h };
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  // Backing-store pixels per CSS pixel at a quality step (never below 1).
  _dprFor(q) {
    const device = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    return Math.max(Math.min(1, device), device * QUALITY_STEPS[q]);
  }

  // Resolution governor: fed each real-time frame's render time. Rendering is fill-bound, so
  // when the rolling time stays above SLOW_MS the backing store steps down (never below one
  // canvas pixel per CSS pixel), and steps back up when there is headroom again. The resize is
  // applied at the start of the next frame (begin()), because resizing clears the canvas.
  noteRender(ms) {
    this.renderMs = this.renderMs ? this.renderMs * 0.95 + ms * 0.05 : ms;
    if (++this.sinceChange < SETTLE_FRAMES) return;
    let q = this.quality;
    if (this.renderMs > SLOW_MS && q < QUALITY_STEPS.length - 1) q++;
    else if (this.renderMs < FAST_MS && q > 0) q--;
    if (q === this.quality) return;
    this.sinceChange = 0;
    const changes = this._dprFor(q) !== this.dpr;
    this.quality = q;
    if (changes) this._resizePending = true;
  }

  // Resets the canvas transform so drawing happens in logical 800x450 units.
  begin() {
    if (this._resizePending) { this._resizePending = false; this.resize(); }
    const k = (this.canvas.width / STAGE_W);
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    return this.ctx;
  }

  // Converts a client (CSS pixel) point to logical stage coordinates.
  toStage(clientX, clientY) {
    return {
      x: (clientX - this.rect.left) / this.rect.width * STAGE_W,
      y: (clientY - this.rect.top) / this.rect.height * STAGE_H,
    };
  }
}
