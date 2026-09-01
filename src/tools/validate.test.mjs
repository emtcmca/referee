/**
 * src/tools/validate.test.mjs — the JSON-Schema subset.
 *
 * This exists because the schema declared to the host is a HINT (03 §6.3): hosts vary in
 * whether they enforce one. Everything the wrapper does downstream assumes a field has the
 * type its schema claims, so this is the function that makes the assumption true.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validate.js';

const SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', enum: ['MS-101', 'MS-102'] },
    quote: { type: 'string', minLength: 40, maxLength: 100 },
    score: { type: 'integer', minimum: 0, maximum: 10 },
    sections: { type: 'array', items: { type: 'string', enum: ['abstract', 'methods'] },
                minItems: 1, maxItems: 8 }
  },
  required: ['id'],
  additionalProperties: false
};

describe('validate()', () => {
  test('accepts a well-formed object', () => {
    const r = validate({ id: 'MS-101', quote: 'x'.repeat(50), score: 7,
                         sections: ['abstract'] }, SCHEMA);
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, []);
  });

  test('reports a missing required field with a usable path', () => {
    const r = validate({}, SCHEMA);
    assert.equal(r.valid, false);
    assert.deepEqual(r.errors[0], { path: '$.id', expected: 'required', got: 'missing' });
  });

  test('enforces enum — this is the check hosts most often skip', () => {
    const r = validate({ id: 'MS-999' }, SCHEMA);
    assert.equal(r.valid, false);
    assert.match(r.errors[0].expected, /one of \[MS-101, MS-102\]/);
  });

  test('enforces minLength and maxLength', () => {
    assert.equal(validate({ id: 'MS-101', quote: 'short' }, SCHEMA).valid, false);
    assert.equal(validate({ id: 'MS-101', quote: 'x'.repeat(200) }, SCHEMA).valid, false);
  });

  test('enforces minimum and maximum on the 0–10 score scale', () => {
    assert.equal(validate({ id: 'MS-101', score: 11 }, SCHEMA).valid, false);
    assert.equal(validate({ id: 'MS-101', score: -1 }, SCHEMA).valid, false);
    assert.equal(validate({ id: 'MS-101', score: 0 }, SCHEMA).valid, true);
  });

  test('integer rejects a float; number would accept it', () => {
    assert.equal(validate({ id: 'MS-101', score: 7.5 }, SCHEMA).valid, false);
    assert.equal(validate(7.5, { type: 'number' }).valid, true);
  });

  test('a boolean is never a number, and an array is never an object', () => {
    assert.equal(validate(true, { type: 'number' }).valid, false);
    assert.equal(validate([], { type: 'object' }).valid, false);
    assert.equal(validate([], { type: 'array' }).valid, true);
    assert.equal(validate(null, { type: 'null' }).valid, true);
  });

  test('additionalProperties:false rejects an unexpected key', () => {
    const r = validate({ id: 'MS-101', surprise: 1 }, SCHEMA);
    assert.equal(r.valid, false);
    assert.equal(r.errors[0].path, '$.surprise');
    assert.equal(r.errors[0].got, 'unexpected property');
  });

  test('validates array items individually and paths them by index', () => {
    const r = validate({ id: 'MS-101', sections: ['abstract', 'references'] }, SCHEMA);
    assert.equal(r.valid, false);
    assert.equal(r.errors[0].path, '$.sections[1]');
  });

  test('enforces minItems and maxItems', () => {
    assert.equal(validate({ id: 'MS-101', sections: [] }, SCHEMA).valid, false);
    assert.equal(
      validate({ id: 'MS-101', sections: Array(9).fill('abstract') }, SCHEMA).valid, false);
  });

  test('a wrong type short-circuits the other keywords rather than cascading', () => {
    const r = validate({ id: 123 }, SCHEMA);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].expected, 'string');
  });

  test('collects every violation, so one retry can fix them all', () => {
    const r = validate({ id: 'MS-999', score: 99, surprise: true }, SCHEMA);
    assert.equal(r.errors.length, 3);
  });

  test('a long string echo is truncated — an error message is not a transcript', () => {
    const r = validate({ id: 'x'.repeat(500) }, SCHEMA);
    assert.ok(r.errors[0].got.length < 120);
  });
});
