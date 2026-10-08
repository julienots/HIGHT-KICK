/** Time helpers. All real-time features (daily shop, breeding, farm) use device clock, offline. */
export const now = () => Date.now();
export const DAY = 86400000;
export const HOUR = 3600000;
export const MIN = 60000;
export function dayIndex(t = Date.now()) {
  // local day boundary
  const d = new Date(t);
  return Math.floor((t - d.getTimezoneOffset() * MIN) / DAY);
}
export function weekIndex(t = Date.now()) {
  // weeks starting on Monday (day 0 = Thu 1 Jan 1970 -> shift by 3)
  return Math.floor((dayIndex(t) + 3) / 7);
}
export function fmtDuration(ms: number) {
  if (ms <= 0) return '0s';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
export function fmtNum(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.floor(n));
}
