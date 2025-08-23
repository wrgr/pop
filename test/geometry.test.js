import test from 'node:test';
import assert from 'node:assert/strict';
import { extrudeLoop, inferWindFromSlices } from '../src/lib/geometry.js';

const square = [
  {x:0,y:0},
  {x:1,y:0},
  {x:1,y:1},
  {x:0,y:1}
];

test('extrudeLoop produces expected mesh size', () => {
  const {mesh} = extrudeLoop(square, {steps:3, wind:[0,0], grow:1});
  assert.equal(mesh.vertices.length, 3*4);
  assert.equal(mesh.faces.length, 2*(3-1)*4);
});

test('inferWindFromSlices recovers horizontal drift', () => {
  const {slices} = extrudeLoop(square, {steps:5, wind:[2,0], grow:0});
  const {wind} = inferWindFromSlices(slices, 1);
  assert.ok(Math.abs(wind[0]-2) < 1e-9);
  assert.ok(Math.abs(wind[1]) < 1e-9);
});

