/**
 * src/core/hash.js — FNV-1a 32-bit over canonical JSON. Synchronous, zero deps, deterministic.
 * 02 §5.2. crypto.subtle is deliberately NOT used: it is async and would make state load a
 * promise for no benefit.
 *
 * BOUNDARY: this module hashes the PUBLIC store only. Hashing identity would require
 * core/hash.js to import identity, which the blinding guard (02 §2.4) forbids. The hash's
 * job is to detect that the text the evidence gate verifies against has changed — and that
 * text is entirely public.
 */

/** Sorts object keys recursively before serializing, so source key order cannot move the hash. */
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}

export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts; >>> 0 keeps it unsigned at every step.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** 'fnv1a32-xxxxxxxx' — the form persisted as state.seedHash. */
export function seedHashOf(payload) {
  return 'fnv1a32-' + fnv1a32(canonicalJSON(payload)).toString(16).padStart(8, '0');
}

/** 8 hex chars. The shared id grammar behind 'f_', 'he_' and 'flag_' (02 PASS 3 · E2). */
export function hash8(str) {
  return fnv1a32(str).toString(16).padStart(8, '0');
}
