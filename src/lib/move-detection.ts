import type { Pt } from "./geometry";
import { BOARD_H, BOARD_W, sideKey, sideOf, type Line, type Shape } from "./josephs-squares";

const CELL = 5;
const COLS = Math.ceil(BOARD_W / CELL) + 2;
const ROWS = Math.ceil(BOARD_H / CELL) + 2;
const idx = (c: number, r: number) => r * COLS + c;

function markSegment(blocked: Uint8Array, a: Pt, b: Pt) {
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const c = Math.floor(x / CELL) + 1;
    const r = Math.floor(y / CELL) + 1;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) blocked[idx(cc, rr)] = 1;
      }
    }
  }
}

function centroid(pts: Pt[]): Pt {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

/**
 * Approximate reachability check: can any free side of one shape still be
 * joined to a free side of another shape without crossing anything?
 * The board is rasterised into a coarse grid; shapes and drawn lines block
 * cells, then we flood fill the open space from every free side.
 */
export function hasLegalMove(shapes: Shape[], lines: Line[], used: Set<string>): boolean {
  const blocked = new Uint8Array(COLS * ROWS);

  for (const shape of shapes) {
    for (let i = 0; i < shape.pts.length; i++) {
      const [a, b] = sideOf(shape, i);
      markSegment(blocked, a, b);
    }
  }
  for (const line of lines) {
    for (let i = 0; i < line.points.length - 1; i++) {
      markSegment(blocked, line.points[i]!, line.points[i + 1]!);
    }
  }

  // seeds: open cells just outside each free side
  const seeds: { shape: number; cell: number }[] = [];
  for (const shape of shapes) {
    const c0 = centroid(shape.pts);
    for (let i = 0; i < shape.pts.length; i++) {
      if (used.has(sideKey(shape.id, i))) continue;
      const [a, b] = sideOf(shape, i);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nx = mid.x - c0.x;
      const ny = mid.y - c0.y;
      const len = Math.hypot(nx, ny) || 1;
      for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        const px = a.x + (b.x - a.x) * t + (nx / len) * (CELL * 3);
        const py = a.y + (b.y - a.y) * t + (ny / len) * (CELL * 3);
        const c = Math.floor(px / CELL) + 1;
        const r = Math.floor(py / CELL) + 1;
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
        const cell = idx(c, r);
        if (!blocked[cell]) seeds.push({ shape: shape.id, cell });
      }
    }
  }
  if (seeds.length < 2) return false;

  // flood fill components
  const comp = new Int32Array(COLS * ROWS).fill(-1);
  const owner = new Map<number, number>(); // component -> first shape id seen
  let next = 0;
  const stack: number[] = [];

  for (const seed of seeds) {
    if (comp[seed.cell] === -1) {
      const id = next++;
      comp[seed.cell] = id;
      stack.push(seed.cell);
      while (stack.length) {
        const cur = stack.pop()!;
        const cc = cur % COLS;
        const rr = (cur - cc) / COLS;
        const neighbours = [
          cc > 0 ? idx(cc - 1, rr) : -1,
          cc < COLS - 1 ? idx(cc + 1, rr) : -1,
          rr > 0 ? idx(cc, rr - 1) : -1,
          rr < ROWS - 1 ? idx(cc, rr + 1) : -1,
        ];
        for (const n of neighbours) {
          if (n < 0 || blocked[n] || comp[n] !== -1) continue;
          comp[n] = id;
          stack.push(n);
        }
      }
    }
    const id = comp[seed.cell]!;
    const prev = owner.get(id);
    if (prev === undefined) owner.set(id, seed.shape);
    else if (prev !== seed.shape) return true;
  }

  return false;
}