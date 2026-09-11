export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const wrap = (value, range) => ((value % range) + range) % range;
export const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

export function renderScale(width, height, deviceRatio, compact) {
  const budget = compact ? 900000 : 1800000;
  return Math.min(deviceRatio || 1, compact ? 1.25 : 1.5, Math.sqrt(budget / Math.max(1, width * height)));
}

export function portalDepth(index, travel, count = 10, spacing = 18) {
  return 35 - wrap(index * spacing - travel + 28, count * spacing);
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
