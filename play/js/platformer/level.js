// Level model built from web/data/levels/<name>.json (written by tools/convert-levels.mjs).
// Mirrors ebug.Level: levelDataGeometry (tile anchor cells), levelDataEntities (entity cells),
// the palette of used tile definitions and the goals. Pure.
import { TILE, T } from './constants.js';

export class Level {
  constructor(data) {
    this.data = data;
    this.name = data.name;
    this.title = data.title;
    this.cols = data.cols;
    this.rows = data.rows;
    this.next = data.next;
    this.bodyLevel = data.bodyLevel;
    this.palette = data.palette;
    this.intro = data.intro || [];
    this.goals = data.goals || [];
    this.playerStart = data.playerStart;
    this.width = this.cols * TILE;
    this.geometry = new Map();
    for (const [r, c, id] of data.tiles) this.geometry.set(r * 4096 + c, id);
    this.entityCells = data.entities.filter(([, , id]) => this.def(id).type !== T.PLAYER);
  }

  // levelDataGeometry[row][col]: the tile id anchored at that cell, or undefined.
  geom(row, col) { return this.geometry.get(row * 4096 + col); }

  def(id) { return this.palette[id]; }

  // Geometry cells that get a physics box: rows 0..rows-1, cols 0..cols inclusive
  // (PlatformGame.as:288-305), in row-major order.
  *solidCells() {
    for (const [r, c, id] of this.data.tiles) if (r >= 0 && r < this.rows && c >= 0 && c <= this.cols) yield [r, c, id];
  }

  // Geometry cells that are drawn: rows 0..rows-1, any column (PlatformGame.as:1081-1089).
  *drawnCells() {
    for (const [r, c, id] of this.data.tiles) if (r >= 0 && r < this.rows) yield [r, c, id];
  }
}
