import test from 'node:test';
import assert from 'node:assert/strict';
import { mapUToAxisRatio, mapAxisRatioToU } from '../src/lib/inference.js';

test('forward then reverse mapping preserves wind speed', () => {
  const U = 2; // m/s
  const R = 0.15; // m
  const shape = mapUToAxisRatio(U, R);
  const { U: inferred } = mapAxisRatioToU(shape.chi, R);
  assert.ok(Math.abs(U - inferred) < 1e-9);
});

test('reverse then forward mapping preserves axis ratio', () => {
  const chi = 1.3;
  const R = 0.15;
  const { U } = mapAxisRatioToU(chi, R);
  const shape = mapUToAxisRatio(U, R);
  assert.ok(Math.abs(chi - shape.chi) < 1e-9);
});

