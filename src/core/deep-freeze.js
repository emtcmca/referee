/**
 * src/core/deep-freeze.js — 02 §1: corpus records are frozen at module load.
 * Zero deps. Cycle-safe. Returns the same object it was handed.
 */
export function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc && 'value' in desc) deepFreeze(desc.value, seen);
  }
  return Object.freeze(value);
}
export default deepFreeze;
