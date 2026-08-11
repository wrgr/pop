import test from 'node:test'
import assert from 'node:assert/strict'
import { createBubble, step, measure, polygonArea, centroid, driftVelocity } from '../src/lib/engine.js'

function settle(state, seconds, p, dt = 1 / 120) {
  for (let t = 0; t < seconds; t += dt) step(state, dt, p)
  return state
}

test('a fresh bubble starts round with near-zero deformation', () => {
  const b = createBubble({ R: 70, n: 56 })
  const m = measure(b)
  assert.ok(m.D < 0.02, `expected round bubble, got D=${m.D}`)
  assert.ok(Math.abs(m.chi - 1) < 0.04)
})

test('pressure vs. tension holds the bubble inflated in still air', () => {
  const b = createBubble({ R: 70, n: 56 })
  const rest = b.restArea
  settle(b, 2.0, { windX: 0, windY: 0, gravity: 0 })
  const area = Math.abs(polygonArea(b.nodes))
  // Should stay within a sensible band of its rest area (not collapse or blow up).
  assert.ok(area > 0.6 * rest && area < 1.4 * rest, `area ${area} vs rest ${rest}`)
})

test('wind drifts the bubble downwind', () => {
  const b = createBubble({ R: 60, n: 56 })
  const before = centroid(b.nodes).x
  settle(b, 1.0, { windX: 150, windY: 0, gravity: 0 })
  const after = centroid(b.nodes).x
  assert.ok(after > before + 20, `expected downwind drift, x ${before} -> ${after}`)
  assert.ok(driftVelocity(b).vx > 0, 'drift velocity should point downwind')
})

test('stronger wind produces greater deformation', () => {
  const mild = createBubble({ R: 60, n: 56 })
  const gale = createBubble({ R: 60, n: 56 })
  settle(mild, 0.8, { windX: 90, windY: 0, gravity: 0 })
  settle(gale, 0.8, { windX: 320, windY: 0, gravity: 0 })
  const dMild = measure(mild).D
  const dGale = measure(gale).D
  assert.ok(dGale > dMild, `expected more deformation in stronger wind: ${dMild} vs ${dGale}`)
})

test('an over-strong wind eventually pops the film', () => {
  // A free bubble accelerates toward the wind speed, so it only over-deforms
  // in the launch transient — it takes a real gale to burst it.
  const b = createBubble({ R: 70, n: 56 })
  settle(b, 3.0, { windX: 1800, windY: 0, gravity: 0 })
  assert.equal(b.popped, true)
})

test('measure() is orientation-invariant (D unchanged when wind is diagonal)', () => {
  const horiz = createBubble({ R: 60, n: 56 })
  const diag = createBubble({ R: 60, n: 56 })
  settle(horiz, 0.6, { windX: 200, windY: 0, gravity: 0 })
  // Same wind magnitude, rotated 45°.
  const w = 200 / Math.SQRT2
  settle(diag, 0.6, { windX: w, windY: w, gravity: 0 })
  const dH = measure(horiz).D
  const dD = measure(diag).D
  assert.ok(Math.abs(dH - dD) < 0.05, `deformation should not depend on wind angle: ${dH} vs ${dD}`)
})
