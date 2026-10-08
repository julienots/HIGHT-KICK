export interface V2 {
  x: number;
  z: number;
}
export const v2 = (x = 0, z = 0): V2 => ({ x, z });
export const len = (x: number, z: number) => Math.sqrt(x * x + z * z);
export const dist = (a: V2, b: V2) => len(a.x - b.x, a.z - b.z);
export const dist2 = (a: V2, b: V2) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function norm(x: number, z: number): V2 {
  const l = len(x, z);
  return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 };
}
export function angleOf(x: number, z: number) {
  return Math.atan2(x, z);
}
export function fromAngle(a: number): V2 {
  return { x: Math.sin(a), z: Math.cos(a) };
}
export function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dampAngle(a: number, b: number, lambda: number, dt: number) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}
/** Distance from point p to segment ab. */
export function distToSegment(p: V2, a: V2, b: V2) {
  const abx = b.x - a.x,
    abz = b.z - a.z;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2 : 0;
  t = clamp(t, 0, 1);
  return len(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}
