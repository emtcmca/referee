/**
 * src/tools/validate.js — the JSON-Schema subset from 03 §3.
 *
 * WHY THE PAGE VALIDATES AT ALL, when inputSchema is already declared to the host:
 * 03 §6.3 — "enum in inputSchema enforced by host vs not: the schema is a hint; the page is
 * the enforcement." A host that drops enum checking, or an agent calling through a relaxed
 * bridge, must hit the same wall. Nothing downstream of this function may assume a field
 * has the type its schema claims.
 *
 * Supported keywords, and deliberately no others: type, required, enum, minLength,
 * maxLength, minimum, maximum, items, minItems, maxItems, properties,
 * additionalProperties:false. That subset covers every schema in 03 §4 exactly.
 *
 * @returns {{valid:boolean, errors:Array<{path:string, expected:string, got:string}>}}
 */

const TYPE_OF = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;               // string | number | boolean | object | undefined
};

/** JSON Schema's `integer` is a subset of `number`, and a boolean is never a number. */
function typeMatches(value, expected) {
  const actual = TYPE_OF(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  if (expected === 'object') return actual === 'object';
  return actual === expected;
}

/** A short, non-leaking description of what arrived. Values are agent-authored, so a */
/** truncated echo is safe — but it is truncated anyway, because a 1200-char quote in an */
/** error message is noise, not information. */
function describe(value) {
  const t = TYPE_OF(value);
  if (t === 'string') {
    return value.length > 60 ? `string(${value.length}) "${value.slice(0, 60)}…"` : `string "${value}"`;
  }
  if (t === 'array') return `array(${value.length})`;
  if (t === 'object') return `object{${Object.keys(value).slice(0, 6).join(',')}}`;
  return `${t} ${String(value)}`;
}

export function validate(value, schema, path = '$') {
  const errors = [];
  walk(value, schema, path, errors);
  return { valid: errors.length === 0, errors };
}

function walk(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') return;

  if (schema.type && value !== undefined && !typeMatches(value, schema.type)) {
    errors.push({ path, expected: schema.type, got: describe(value) });
    return;                       // a wrong type makes every other keyword meaningless
  }

  if (Array.isArray(schema.enum) && value !== undefined && !schema.enum.includes(value)) {
    errors.push({
      path,
      expected: `one of [${schema.enum.join(', ')}]`,
      got: describe(value)
    });
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push({ path, expected: `minLength ${schema.minLength}`, got: `length ${value.length}` });
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push({ path, expected: `maxLength ${schema.maxLength}`, got: `length ${value.length}` });
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push({ path, expected: `minimum ${schema.minimum}`, got: String(value) });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push({ path, expected: `maximum ${schema.maximum}`, got: String(value) });
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push({ path, expected: `minItems ${schema.minItems}`, got: `${value.length} items` });
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push({ path, expected: `maxItems ${schema.maxItems}`, got: `${value.length} items` });
    }
    if (schema.items) {
      value.forEach((item, i) => walk(item, schema.items, `${path}[${i}]`, errors));
    }
  }

  if (schema.type === 'object' || schema.properties || schema.required) {
    const obj = value === undefined ? {} : value;
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return;

    for (const key of schema.required || []) {
      if (obj[key] === undefined) {
        errors.push({ path: `${path}.${key}`, expected: 'required', got: 'missing' });
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) {
          errors.push({
            path: `${path}.${key}`,
            expected: `one of [${[...allowed].join(', ')}]`,
            got: 'unexpected property'
          });
        }
      }
    }

    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (obj[key] !== undefined) walk(obj[key], sub, `${path}.${key}`, errors);
    }
  }
}
