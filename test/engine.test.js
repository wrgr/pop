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

// --- Gravity sag (Bond number) ---

// Center of mass = plain vertex mean (each node has equal mass). A zero-net
// force term (sag is de-meaned) must conserve this.
function centerOfMass(state) {
  let x = 0
  let y = 0
  for (const nd of state.nodes) {
    x += nd.x
    y += nd.y
  }
  return { x: x / state.nodes.length, y: y / state.nodes.length }
}

test('gravity sag stretches the bubble vertically without translating it', () => {
  const b = createBubble({ R: 80, n: 56 })
  const c0 = centerOfMass(b)
  settle(b, 3.0, { windX: 0, windY: 0, gravity: 0, sag: 0.03 })
  const c1 = centerOfMass(b)
  assert.ok(Math.hypot(c1.x - c0.x, c1.y - c0.y) < 5, 'sag should deform, not translate')
  const m = measure(b)
  assert.ok(m.D > 0.1, `sag should visibly elongate the bubble: D=${m.D}`)
  // Major axis vertical (≈ ±90°): this is precisely why gravity mimics a
  // vertical wind — from the shape alone the two are indistinguishable.
  assert.ok(
    Math.abs(Math.abs(m.angle) - Math.PI / 2) < 0.25,
    `sag axis should be vertical: ${((m.angle * 180) / Math.PI).toFixed(0)}°`,
  )
})

test('stronger sag (higher Bond number) elongates more', () => {
  const mild = createBubble({ R: 80, n: 56 })
  const heavy = createBubble({ R: 80, n: 56 })
  settle(mild, 3.0, { windX: 0, windY: 0, gravity: 0, sag: 0.015 })
  settle(heavy, 3.0, { windX: 0, windY: 0, gravity: 0, sag: 0.04 })
  assert.ok(measure(heavy).D > measure(mild).D, 'more sag -> more deformation')
})

// --- Film mass -> Rayleigh–Lamb shape oscillation ---

function deformationSeries(squash, mass, damping, seconds = 2) {
  const b = createBubble({ R: 70, n: 56, squash })
  const dt = 1 / 120
  const series = []
  for (let t = 0; t < seconds; t += dt) {
    step(b, dt, { windX: 0, windY: 0, gravity: 0, mass, damping })
    series.push(measure(b).D)
  }
  return series
}

test('createBubble squash preserves area (pinch-off is volume-conserving)', () => {
  const round = createBubble({ R: 70, n: 56 })
  const pinched = createBubble({ R: 70, n: 56, squash: 0.35 })
  const a0 = Math.abs(polygonArea(round.nodes))
  const a1 = Math.abs(polygonArea(pinched.nodes))
  assert.ok(Math.abs(a1 - a0) / a0 < 0.02, `squash should conserve area: ${a0} vs ${a1}`)
  assert.ok(measure(pinched).D > 0.2, 'a pinched bubble starts visibly deformed')
})

test('a lightly damped film rings (deformation rebounds, not monotonic)', () => {
  const D = deformationSeries(0.35, 1, 0.9)
  // Find the first local minimum, then confirm it rises again afterwards.
  let minIdx = 0
  for (let i = 1; i < D.length; i++) {
    if (D[i] < D[minIdx]) minIdx = i
    else if (i - minIdx > 6) break // passed a clear minimum
  }
  const laterMax = Math.max(...D.slice(minIdx))
  assert.ok(laterMax > D[minIdx] + 0.02, `expected a rebound after the dip: min=${D[minIdx]} laterMax=${laterMax}`)
})

test('a heavier film relaxes more slowly (higher inertia)', () => {
  const light = deformationSeries(0.35, 1, 0.9, 1.5)
  const heavy = deformationSeries(0.35, 3, 0.9, 1.5)
  const endLight = light[light.length - 1]
  const endHeavy = heavy[heavy.length - 1]
  assert.ok(endHeavy > endLight, `heavier film should still be deformed later: light=${endLight} heavy=${endHeavy}`)
})
