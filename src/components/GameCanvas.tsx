import { useCallback, useEffect, useRef } from "react";
import {
  closestOnSeg,
  dist,
  distToSeg,
  segIntersect,
  type Pt,
} from "@/lib/geometry";
import {
  BOARD_H,
  BOARD_W,
  sideKey,
  sideOf,
  type Line,
  type Shape,
} from "@/lib/josephs-squares";

const SNAP = 22;

type Stroke = {
  points: Pt[];
  startShape: number;
  startSide: number;
  invalid: boolean;
};

type Props = {
  shapes: Shape[];
  lines: Line[];
  used: Set<string>;
  currentPlayer: 0 | 1;
  locked: boolean;
  onCommit: (line: Line, startKey: string, endKey: string) => void;
  onMessage: (msg: string) => void;
};

function readVar(el: HTMLElement, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function GameCanvas({
  shapes,
  lines,
  used,
  currentPlayer,
  locked,
  onCommit,
  onMessage,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const stateRef = useRef({ shapes, lines, used, currentPlayer, locked });
  stateRef.current = { shapes, lines, used, currentPlayer, locked };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    const paper = readVar(canvas, "--paper") || "#fff";
    const rule = readVar(canvas, "--pencil");
    const ink = readVar(canvas, "--ink");
    const players = [readVar(canvas, "--player-a"), readVar(canvas, "--player-b")];

    const scale = Math.min(rect.width / BOARD_W, rect.height / BOARD_H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // faint notebook grid
    ctx.strokeStyle = rule;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let x = 0; x < rect.width; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(rect.width, y + 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (rect.width - BOARD_W * scale) * dpr / 2, (rect.height - BOARD_H * scale) * dpr / 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const { shapes: sh, lines: ls, used: us } = stateRef.current;

    // shapes
    for (const shape of sh) {
      for (let i = 0; i < shape.pts.length; i++) {
        const [a, b] = sideOf(shape, i);
        const taken = us.has(sideKey(shape.id, i));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = ink;
        ctx.globalAlpha = taken ? 0.28 : 1;
        ctx.lineWidth = taken ? 5 : 7;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // committed lines
    for (const line of ls) {
      ctx.strokeStyle = players[line.player] || ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      line.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      for (const p of [line.points[0]!, line.points[line.points.length - 1]!]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = players[line.player] || ink;
        ctx.fill();
      }
    }

    // active stroke
    const stroke = strokeRef.current;
    if (stroke && stroke.points.length > 1) {
      ctx.strokeStyle = stroke.invalid
        ? readVar(canvas, "--foul")
        : players[stateRef.current.currentPlayer] || ink;
      ctx.lineWidth = 6;
      ctx.globalAlpha = stroke.invalid ? 0.8 : 0.9;
      ctx.beginPath();
      stroke.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, []);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [draw, shapes, lines, used, currentPlayer]);

  const toBoard = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / BOARD_W, rect.height / BOARD_H);
    const ox = (rect.width - BOARD_W * scale) / 2;
    const oy = (rect.height - BOARD_H * scale) / 2;
    return {
      x: (e.clientX - rect.left - ox) / scale,
      y: (e.clientY - rect.top - oy) / scale,
    };
  };

  const nearestFreeSide = (p: Pt, excludeShape?: number) => {
    const { shapes: sh, used: us } = stateRef.current;
    let best: { shape: number; side: number; point: Pt; d: number } | null = null;
    for (const shape of sh) {
      if (excludeShape !== undefined && shape.id === excludeShape) continue;
      for (let i = 0; i < shape.pts.length; i++) {
        if (us.has(sideKey(shape.id, i))) continue;
        const [a, b] = sideOf(shape, i);
        const d = distToSeg(p, a, b);
        if (d <= SNAP && (!best || d < best.d)) {
          best = { shape: shape.id, side: i, point: closestOnSeg(p, a, b), d };
        }
      }
    }
    return best;
  };

  const commit = (endPoint: Pt, endShape: number, endSide: number) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const points = [...stroke.points, endPoint];
    strokeRef.current = null;
    onCommit(
      { points, player: stateRef.current.currentPlayer },
      sideKey(stroke.startShape, stroke.startSide),
      sideKey(endShape, endSide),
    );
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.locked) return;
    const p = toBoard(e);
    const start = nearestFreeSide(p);
    if (!start) {
      onMessage("Start your line on a free side of a shape.");
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeRef.current = {
      points: [start.point],
      startShape: start.shape,
      startSide: start.side,
      invalid: false,
    };
    draw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.invalid) return;
    const p = toBoard(e);
    const last = stroke.points[stroke.points.length - 1]!;
    if (dist(p, last) < 4) return;

    const { shapes: sh, lines: ls, used: us } = stateRef.current;
    const segLen = dist(p, last) || 1;
    type Hit = { t: number; point: Pt; kind: "end" | "foul"; shape?: number; side?: number };
    let hit: Hit | null = null;
    const consider = (h: Hit) => {
      if (!hit || h.t < hit.t) hit = h;
    };

    for (const shape of sh) {
      for (let i = 0; i < shape.pts.length; i++) {
        if (shape.id === stroke.startShape && i === stroke.startSide) continue;
        const [a, b] = sideOf(shape, i);
        const x = segIntersect(last, p, a, b);
        if (!x) continue;
        const free = !us.has(sideKey(shape.id, i));
        const t = dist(x, last) / segLen;
        if (free && shape.id !== stroke.startShape) {
          consider({ t, point: x, kind: "end", shape: shape.id, side: i });
        } else {
          consider({ t, point: x, kind: "foul" });
        }
      }
    }

    for (const line of ls) {
      for (let i = 0; i < line.points.length - 1; i++) {
        const x = segIntersect(last, p, line.points[i]!, line.points[i + 1]!);
        if (x) consider({ t: dist(x, last) / segLen, point: x, kind: "foul" });
      }
    }

    for (let i = 0; i < stroke.points.length - 2; i++) {
      const x = segIntersect(last, p, stroke.points[i]!, stroke.points[i + 1]!);
      if (x) consider({ t: dist(x, last) / segLen, point: x, kind: "foul" });
    }

    const h = hit as Hit | null;
    if (h && h.kind === "foul") {
      stroke.invalid = true;
      stroke.points.push(h.point);
      onMessage("No crossing — lines can't cut shapes or other lines.");
      draw();
      return;
    }
    if (h && h.kind === "end") {
      commit(h.point, h.shape!, h.side!);
      return;
    }

    stroke.points.push(p);
    draw();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    if (!stroke.invalid) {
      const p = toBoard(e);
      const end = nearestFreeSide(p, stroke.startShape);
      if (end && stroke.points.length > 1) {
        commit(end.point, end.shape, end.side);
        draw();
        return;
      }
      onMessage("Finish on a free side of a different shape.");
    }
    strokeRef.current = null;
    draw();
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none rounded-[inherit]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
