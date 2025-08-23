import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCircularLoop, simulateWand } from '../src/lib/wand.js';


// Basic geometric check that points lie on a circle of given radius
// and that simulation preserves point count.

test('makeCircularLoop generates circle and simulateWand preserves length', () => {
  const r = 1;
  const pts = makeCircularLoop(r, 8);
  assert.equal(pts.length, 8);
  for(const p of pts){
    const d = Math.hypot(p.x, p.y);
    assert.ok(Math.abs(d - r) < 1e-9);
  }
  const swayed = simulateWand(pts, {U:1, t:0.5});
  assert.equal(swayed.length, pts.length);
});

