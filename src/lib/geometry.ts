export type Pt = { x: number; y: number };

export function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function cross(a: Pt, b: Pt): number {
  return a.x * b.y - a.y * b.x;
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Proper segment intersection. Returns the intersection point or null.
 * Collinear overlaps are reported at the first shared endpoint.
 */
export function segIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const r = sub(p2, p1);
  const s = sub(p4, p3);
  const denom = cross(r, s);
  const qp = sub(p3, p1);

  if (Math.abs(denom) < 1e-9) {
    if (Math.abs(cross(qp, r)) > 1e-9) return null;
    const rr = r.x * r.x + r.y * r.y;
    if (rr < 1e-9) return null;
    const t0 = (qp.x * r.x + qp.y * r.y) / rr;
    const t1 = t0 + (s.x * r.x + s.y * r.y) / rr;
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(1, Math.max(t0, t1));
    if (lo > hi) return null;
    return { x: p1.x + r.x * lo, y: p1.y + r.y * lo };
  }

  const t = cross(qp, s) / denom;
  const u = cross(qp, r) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + r.x * t, y: p1.y + r.y * t };
}

/** Closest point on segment ab to p. */
export function closestOnSeg(p: Pt, a: Pt, b: Pt): Pt {
  const ab = sub(b, a);
  const len2 = ab.x * ab.x + ab.y * ab.y;
  if (len2 < 1e-9) return a;
  let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

export function distToSeg(p: Pt, a: Pt, b: Pt): number {
  return dist(p, closestOnSeg(p, a, b));
}

/** Regular polygon centred at c, first vertex pointing up. */
export function polygon(c: Pt, sides: number, radius: number, rotation = 0): Pt[] {
  const pts: Pt[] = [];
  const offset = sides === 4 ? Math.PI / 4 : -Math.PI / 2;
  for (let i = 0; i < sides; i++) {
    const a = offset + rotation + (i * 2 * Math.PI) / sides;
    pts.push({ x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) });
  }
  return pts;
}
/** Centroid of a polygon's vertices. */
export function centroid(pts: Pt[]): Pt {
  const n = pts.length || 1;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  };
}

/**
 * Signed angle (radians) swept around `c` by a polyline. |value| near 2π means
 * the path wraps a full circle around that point.
 */
export function windingAngle(points: Pt[], c: Pt): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = sub(points[i]!, c);
    const b = sub(points[i + 1]!, c);
    const la = Math.hypot(a.x, a.y);
    const lb = Math.hypot(b.x, b.y);
    if (la < 1e-6 || lb < 1e-6) continue;
    const dot = (a.x * b.x + a.y * b.y) / (la * lb);
    total += Math.atan2(cross(a, b), dot * la * lb === 0 ? dot : dot);
  }
  return total;
}
