// Shared helpers for the platform game unit tests (node --test).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlatformGame } from '../../js/platformer/game.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const loadLevel = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'web/data/levels', `${name}.json`), 'utf8'));

// Palette entries used by synthetic levels (sizes as in tile_definitions.json).
export const PAL = {
  floor: { id: 30, movie: 'Unit_2_Tile', type: 1, w: 50, h: 50, ax: 0, ay: 0 },
  toast: { id: 26, movie: 'toast_jam_obj', type: 1, w: 250, h: 50, ax: 0, ay: 0 },
  lucy: { id: 93, movie: 'lucy_icon', type: 11, w: 42.32, h: 97.58, ax: -0.46, ay: -0.38 },
  steve: { id: 94, movie: 'steve_icon', type: 14, w: 74.1, h: 72.94, ax: -0.4, ay: -0.6 },
  slurm: { id: 100, movie: 'slurm_icon', type: 17, w: 75.64, h: 72.44, ax: -0.34, ay: 0.08 },
  portal: { id: 107, movie: 'portal_exit_icon', type: 6, w: 103.6, h: 163.8, ax: -0.5, ay: -0.5 },
  start: { id: 111, movie: 'player_start', type: 0, w: 31.2, h: 53.6, ax: 9.4, ay: -0.5 },
  milk: { id: 106, movie: 'milk_glass_icon', type: 20, w: 150, h: 200, ax: 0, ay: 0 },
  antibiotic: { id: 112, movie: 'antibiotic_pickup', type: 21, w: 38.3, h: 16.3, ax: 0, ay: 0 },
  superinfection: { id: 102, movie: 'superinfection_icon', type: 23, w: 409.15, h: 195.42, ax: 2.35, ay: 4.14 },
  white: { id: 110, movie: 'white_pickup', type: 9, w: 39.1, h: 42.1, ax: 6, ay: 0 },
};

/**
 * A flat test level: a floor along row 8 (top at y = 400), the player at (7-1, startCol) standing
 * on it, plus the given entity cells. entities: [[row, col, key], ...] with keys from PAL.
 * gap: [fromCol, toCol] leaves a hole in the floor (the world floor is then at y = 450).
 */
export function flatLevel({ cols = 40, bodyLevel = true, goals = [], startCol = 2, entities = [], extraTiles = [], gap = null, startRow = 6 } = {}) {
  const palette = {};
  const use = key => { const d = PAL[key]; palette[d.id] = { movie: d.movie, type: d.type, w: d.w, h: d.h, ax: d.ax, ay: d.ay }; return d.id; };
  const tiles = [];
  for (let c = 0; c < cols; c++) if (!gap || c < gap[0] || c > gap[1]) tiles.push([8, c, use('floor')]);
  for (const [r, c, key] of extraTiles) tiles.push([r, c, use(key)]);
  tiles.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ents = [[startRow, startCol, use('start')], ...entities.map(([r, c, key]) => [r, c, use(key)])].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return {
    name: 'test_level', title: 'test', id: null, cols, rows: 9, next: 'exit', bodyLevel, goals,
    playerStart: { row: startRow, col: startCol }, tiles, entities: ents, palette, intro: [], outOfRange: [],
  };
}

export const NO_INPUT = Object.freeze({ left: false, right: false, jumpHeld: false, jumpPressed: false, jumpReleased: false, firePressed: false, cameraPressed: false });
export const inp = (o = {}) => ({ ...NO_INPUT, ...o });

export function newGame(level, opts) {
  const g = new PlatformGame(level, opts);
  g.start();
  return g;
}

// Steps until the player has settled on the ground (no vertical motion for a few steps).
export function settle(g, max = 80) {
  let still = 0;
  for (let i = 0; i < max && still < 4; i++) {
    const y = g.player.particle.position.y;
    g.step(inp());
    still = Math.abs(g.player.particle.position.y - y) < 1e-9 ? still + 1 : 0;
  }
  return g;
}
