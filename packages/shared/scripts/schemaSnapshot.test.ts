import { describe, expect, it } from 'vitest';
import { buildSnapshot, diffSnapshots } from './schemaSnapshot';

describe('buildSnapshot', () => {
  it('serializes every exported *Schema value from schemas.ts', () => {
    const snapshot = buildSnapshot();
    expect(snapshot.cardSchema).toBeDefined();
    expect(snapshot.feedResponseSchema).toBeDefined();
    expect(snapshot.topicSchema).toMatchObject({ enum: expect.any(Array) });
  });
});

describe('diffSnapshots', () => {
  it('flags a removed field', () => {
    const previous = {
      thing: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
    };
    const next = { thing: { type: 'object', properties: {}, required: [] } };
    expect(diffSnapshots(previous, next)).toEqual(['thing.a: removed']);
  });

  it('flags a field that went from required to optional', () => {
    const previous = {
      thing: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
    };
    const next = {
      thing: { type: 'object', properties: { a: { type: 'string' } }, required: [] },
    };
    expect(diffSnapshots(previous, next)).toEqual(['thing.a: was required, now optional']);
  });

  it('flags a changed field type', () => {
    const previous = { thing: { type: 'object', properties: { a: { type: 'string' } } } };
    const next = { thing: { type: 'object', properties: { a: { type: 'number' } } } };
    expect(diffSnapshots(previous, next)).toEqual([
      'thing.a: type changed from "string" to "number"',
    ]);
  });

  it('flags a removed enum value', () => {
    const previous = { thing: { type: 'string', enum: ['a', 'b'] } };
    const next = { thing: { type: 'string', enum: ['a'] } };
    expect(diffSnapshots(previous, next)).toEqual(['thing: enum value "b" removed']);
  });

  it('flags a removed schema entirely', () => {
    const previous = { thing: { type: 'string' } };
    const next = {};
    expect(diffSnapshots(previous, next)).toEqual(['thing: removed']);
  });

  it('does not flag a new optional field', () => {
    const previous = {
      thing: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
    };
    const next = {
      thing: {
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'string' } },
        required: ['a'],
      },
    };
    expect(diffSnapshots(previous, next)).toEqual([]);
  });

  it('does not flag a new enum value', () => {
    const previous = { thing: { type: 'string', enum: ['a'] } };
    const next = { thing: { type: 'string', enum: ['a', 'b'] } };
    expect(diffSnapshots(previous, next)).toEqual([]);
  });

  it('does not flag a newly added schema', () => {
    const previous = {};
    const next = { thing: { type: 'string' } };
    expect(diffSnapshots(previous, next)).toEqual([]);
  });

  it('recurses into array items', () => {
    const previous = {
      thing: {
        type: 'array',
        items: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
      },
    };
    const next = {
      thing: { type: 'array', items: { type: 'object', properties: {}, required: [] } },
    };
    expect(diffSnapshots(previous, next)).toEqual(['thing[].a: removed']);
  });

  it('matches discriminated-union branches by their tag and flags a removed field within one branch', () => {
    const previous = {
      thing: {
        oneOf: [
          {
            type: 'object',
            properties: { type: { const: 'paragraph' }, text: { type: 'string' } },
            required: ['type', 'text'],
          },
          {
            type: 'object',
            properties: { type: { const: 'image' }, figureIndex: { type: 'integer' } },
            required: ['type', 'figureIndex'],
          },
        ],
      },
    };
    const next = {
      thing: {
        oneOf: [
          { type: 'object', properties: { type: { const: 'paragraph' } }, required: ['type'] },
          {
            type: 'object',
            properties: { type: { const: 'image' }, figureIndex: { type: 'integer' } },
            required: ['type', 'figureIndex'],
          },
        ],
      },
    };
    expect(diffSnapshots(previous, next)).toEqual(['thing[paragraph].text: removed']);
  });
});
