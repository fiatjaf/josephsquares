import type { Pt } from "./geometry";
import { polygon } from "./geometry";

export const BOARD_W = 1000;
export const BOARD_H = 700;

export type ShapeKind = 3 | 4;

export type Shape = {
  id: number;
  pts: Pt[];
};

export type Line = {
  points: Pt[];
  player: 0 | 1;
};

export const sideKey = (shapeId: number, sideIdx: number) => `${shapeId}:${sideIdx}`;

export function sideOf(shape: Shape, i: number): [Pt, Pt] {
  return [shape.pts[i]!, shape.pts[(i + 1) % shape.pts.length]!];
}

export function createShapes(count: number, kind: ShapeKind): Shape[] {
  const cx = BOARD_W / 2;
  const cy = BOARD_H / 2;

  if (count === 2) {
    const r = 110;
    return [
      { id: 0, pts: polygon({ x: cx - 210, y: cy }, kind, r) },
      { id: 1, pts: polygon({ x: cx + 210, y: cy }, kind, r) },
    ];
  }

  const ring = count <= 4 ? 215 : 245;
  const r = count <= 3 ? 105 : count <= 5 ? 90 : 74;

  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return {
      id: i,
      pts: polygon({ x: cx + ring * Math.cos(a) * 1.25, y: cy + ring * Math.sin(a) }, kind, r),
    };
  });
}