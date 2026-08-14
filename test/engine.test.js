import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBubble,
  step,
  measure,
  polygonArea,
  centroid,
  driftVelocity,
  launchGeometry,
} from '../src/lib/engine.js'

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

// --- Launcher: string loop vs. rigid wand ---

test('a rigid wand launches a round bubble at a fixed size, ignoring wind', () => {
  const calm = launchGeometry({ type: 'wand', R: 70, sep: 0.8, windPx: 0 })
  const gale = launchGeometry({ type: 'wand', R: 70, sep: 0.8, windPx: 400 })
  // Rigid: size fixed by the hoop, opening does not billow with wind...
  assert.equal(calm.R, 70)
  assert.equal(gale.R, 70)
  // ...handle separation is irrelevant, and the imprint is only the small pinch.
  assert.ok(calm.squash < 0.2, `wand should birth a nearly round bubble: squash=${calm.squash}`)
  assert.equal(calm.tilt, 0)
})

test('a string loop imprints elongation from handle separation', () => {
  const round = launchGeometry({ type: 'loop', R: 70, sep: 0, windPx: 0 })
  const stretched = launchGeometry({ type: 'loop', R: 70, sep: 1, windPx: 0 })
  assert.ok(stretched.squash > round.squash + 0.5, `pulling handles apart should elongate: ${round.squash} -> ${stretched.squash}`)
})

test('wind billows a string loop open (bigger bubble), but never a rigid wand', () => {
  const loopCalm = launchGeometry({ type: 'loop', R: 70, sep: 0.4, windPx: 0 })
  const loopWind = launchGeometry({ type: 'loop', R: 70, sep: 0.4, windPx: 400 })
  assert.ok(loopWind.R > loopCalm.R + 5, `wind should open the loop: ${loopCalm.R} -> ${loopWind.R}`)
})

test('createBubble tilt rotates the launcher imprint (major axis follows tilt)', () => {
  const horiz = createBubble({ R: 70, n: 56, squash: 0.5, tilt: 0 })
  const vert = createBubble({ R: 70, n: 56, squash: 0.5, tilt: Math.PI / 2 })
  // A horizontal imprint has its major axis near 0°, a 90°-tilted one near ±90°.
  assert.ok(Math.abs(measure(horiz).angle) < 0.15, `untilted imprint should be horizontal: ${measure(horiz).angle}`)
  assert.ok(Math.abs(Math.abs(measure(vert).angle) - Math.PI / 2) < 0.15, `tilted imprint should be vertical: ${measure(vert).angle}`)
  // Rotation preserves area.
  assert.ok(Math.abs(Math.abs(polygonArea(vert.nodes)) - Math.abs(polygonArea(horiz.nodes))) < 1, 'tilt should preserve area')
})

// --- Wake (leeward suction) and spin ---

// Extents of the membrane windward/leeward of its centroid, measured along the
// wind direction (+x here).
function foreAft(state) {
  const c = centroid(state.nodes)
  let lee = 0 // downwind (+x) reach
  let front = 0 // upwind (-x) reach
  for (const nd of state.nodes) {
    lee = Math.max(lee, nd.x - c.x)
    front = Math.max(front, c.x - nd.x)
  }
  return { lee, front }
}

// Hold the bubble in place so the shape is read in a clean frame (the wake adds
// some real downwind drift we don't want to chase across the domain).
function held(state, seconds, p, dt = 1 / 120) {
  for (let t = 0; t < seconds; t += dt) {
    step(state, dt, p)
    const c = centroid(state.nodes)
    for (const nd of state.nodes) {
      nd.x += 360 - c.x
      nd.y += 200 - c.y
    }
  }
  return state
}

test('the wake draws the leeward side out into a tail (fore-aft asymmetry)', () => {
  const noWake = held(createBubble({ R: 60, n: 56 }), 1.2, { windX: 180, windY: 0, gravity: 0, wake: 0 })
  const wake = held(createBubble({ R: 60, n: 56 }), 1.2, { windX: 180, windY: 0, gravity: 0, wake: 3 })
  const a0 = foreAft(noWake)
  const a1 = foreAft(wake)
  // The wake pushes the leeward reach out past the windward reach; without it
  // the shape is not leeward-biased.
  assert.ok(a1.lee - a1.front > a0.lee - a0.front + 4, `wake should extend the tail: no-wake=${(a0.lee - a0.front).toFixed(1)} wake=${(a1.lee - a1.front).toFixed(1)}`)
  assert.ok(a1.lee > a1.front, `leeward tail should out-reach the windward face: lee=${a1.lee.toFixed(1)} front=${a1.front.toFixed(1)}`)
})

test('spin rotates the membrane so an elongated bubble tumbles', () => {
  // Start elongated (a launcher imprint) so rotation is observable.
  const b = createBubble({ R: 70, n: 56, squash: 0.4 })
  const a0 = measure(b).angle
  settle(b, 0.5, { windX: 0, windY: 0, gravity: 0, spin: 3, damping: 1 })
  const a1 = measure(b).angle
  assert.ok(Math.abs(a1 - a0) > 0.4, `a spinning elongated bubble should change its measured tilt: ${a0} -> ${a1}`)
  assert.ok((b.spinAngle || 0) > 1, 'spinAngle should accumulate')
})

test('spin conserves the shape (a round bubble stays round while spinning)', () => {
  const b = createBubble({ R: 60, n: 56 })
  settle(b, 0.6, { windX: 0, windY: 0, gravity: 0, spin: 4 })
  assert.ok(measure(b).D < 0.03, 'pure spin should not deform a round bubble')
})

// --- Film lifetime (drainage & evaporation) ---

// Seconds until the wall ruptures in still air.
function lifetime(opts, cap = 120) {
  const b = createBubble({ R: opts.R || 70, n: 56, thickness: opts.thickness })
  const dt = 1 / 60
  for (let t = 0; t < cap; t += dt) {
    step(b, dt, { windX: 0, windY: 0, gravity: 10, drainage: opts.drainage ?? 220, evaporation: opts.evaporation ?? 18 })
    if (b.popped) return { t, reason: b.popReason }
  }
  return { t: Infinity, reason: null }
}

test('a filmed bubble drains and ruptures on its own', () => {
  const r = lifetime({ thickness: 800 })
  assert.ok(isFinite(r.t) && r.t > 0.5, `should live a bit then pop: ${r.t}`)
  assert.equal(r.reason, 'drained')
})

test('a thicker film lasts longer', () => {
  assert.ok(lifetime({ thickness: 2500 }).t > lifetime({ thickness: 500 }).t)
})

test('drier air (more evaporation) shortens the life', () => {
  assert.ok(lifetime({ thickness: 1000, evaporation: 34 }).t < lifetime({ thickness: 1000, evaporation: 8 }).t)
})

test('without a thickness there is no drainage (unchanged behaviour)', () => {
  const b = createBubble({ R: 70, n: 56 }) // thickness null
  settle(b, 3, { windX: 0, windY: 0, gravity: 10, drainage: 500, evaporation: 500 })
  assert.equal(b.popped, false, 'no thickness ⇒ drainage does nothing')
})

// --- Convective evaporation: wind shortens the film's life ---

function lifetimeInWind({ thickness = 1000, evaporation = 18, windX = 0, windThinning = 0 }, cap = 120) {
  const b = createBubble({ R: 70, n: 56, thickness })
  const dt = 1 / 60
  for (let t = 0; t < cap; t += dt) {
    step(b, dt, { windX, windY: 0, gravity: 10, drainage: 220, evaporation, windThinning })
    if (b.popped) return { t, reason: b.popReason }
  }
  return { t: Infinity, reason: null }
}

test('a bubble that lags the wind drains faster than one in still air', () => {
  const still = lifetimeInWind({ windX: 0, windThinning: 0.14 })
  const windy = lifetimeInWind({ windX: 170, windThinning: 0.14 })
  assert.ok(windy.t < still.t, `wind should shorten life: still=${still.t} windy=${windy.t}`)
  assert.equal(windy.reason, 'drained')
})

test('windThinning is what adds the wind penalty (same wind, convection off ⇒ longer)', () => {
  // Isolate convection from wind-driven deformation: identical wind, only the
  // convective term differs.
  const off = lifetimeInWind({ windX: 170, windThinning: 0 })
  const on = lifetimeInWind({ windX: 170, windThinning: 0.14 })
  assert.ok(on.t < off.t, `convective evaporation should add a wind penalty: off=${off.t} on=${on.t}`)
})

test('with nothing to evaporate (humid air), wind adds no convective loss', () => {
  // evaporation 0 ⇒ the convective term is inert; only drainage thins the wall,
  // so windThinning must not change the life at all.
  const off = lifetimeInWind({ evaporation: 0, windX: 170, windThinning: 0 })
  const on = lifetimeInWind({ evaporation: 0, windX: 170, windThinning: 0.14 })
  assert.equal(on.t, off.t, 'no evaporation ⇒ wind cannot speed thinning')
})
