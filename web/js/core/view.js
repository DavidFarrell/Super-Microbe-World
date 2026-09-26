// Stage scaling. The original Flash stage is 800x450 (16:9); everything is authored in
// those logical units and letterboxed to fit any screen, respecting safe-area insets.
export const STAGE_W = 800;
export const STAGE_H = 450;

export class View {
  constructor(root, canvas, ui) {
    this.root = root;
    this.canvas = canvas;
    this.ui = ui;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.scale = 1;
    this.dpr = 1;
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
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    Object.assign(this.canvas.style, { width: w + 'px', height: h + 'px', left: left + 'px', top: top + 'px' });
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    // The DOM UI layer is authored at 800x450 and scaled as a whole, so text stays crisp.
    Object.assign(this.ui.style, { left: left + 'px', top: top + 'px', transform: `scale(${w / STAGE_W})` });
    this.rect = { left: r.left + left, top: r.top + top, width: w, height: h };
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  // Resets the canvas transform so drawing happens in logical 800x450 units.
  begin() {
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
