import test from 'node:test'
import assert from 'node:assert/strict'
import { createBubble, step, measure, launchGeometry } from '../src/lib/engine.js'
import { analyzeSeries, linFit, quadFit, unwrapAxis } from '../src/lib/forensics.js'

const PX = 26 // px per m/s, matching the visualization

// Fly a bubble forward with known parameters and record the shape series a
// video would yield. The forensics then has to recover those parameters.
function record({ windMs = 0, gravity = 10, spin = 0, launcher = 'wand', sep = 0.5, film = 1, seconds = 2.2 } = {}) {
  const g = launchGeometry({ type: launcher, R: 66, sep, windPx: windMs * PX })
  const b = createBubble({ cx: 190, cy: 180, R: g.R, n: 56, vx: windMs * PX * 0.3, vy: -40, squash: g.squash, tilt: g.tilt })
  const frames = []
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) {
    step(b, dt, { windX: windMs * PX, windY: 0, gravity, mass: 0.5 + film * 0.6, spin, sag: 0 })
    const m = measure(b)
    frames.push({ t, D: m.D, chi: m.chi, angle: m.angle, area: m.area, cx: m.centroid.x, cy: m.centroid.y })
    if (b.popped) break
  }
  return frames
}
const analyze = (cfg) => analyzeSeries(record(cfg), { pxPerMs: PX })

// --- pure numeric helpers ---

test('linFit recovers a known line', () => {
  const xs = [0, 1, 2, 3, 4]
  const ys = xs.map((x) => 3 * x + 5)
  const f = linFit(xs, ys)
  assert.ok(Math.abs(f.slope - 3) < 1e-9 && Math.abs(f.intercept - 5) < 1e-9)
  assert.ok(f.r2 > 0.999)
})

test('quadFit recovers a known parabola (curvature = 2c)', () => {
  const ts = [0, 0.5, 1, 1.5, 2, 2.5]
  const ys = ts.map((t) => 2 + 3 * t + 4 * t * t)
  const f = quadFit(ts, ys)
  assert.ok(Math.abs(f.c - 4) < 1e-6, `c=${f.c}`)
})

test('unwrapAxis makes a π-wrapping ramp continuous', () => {
  // A steady rotation that wraps past ±π/2 should unwrap to a straight ramp.
  const raw = []
  for (let i = 0; i < 10; i++) {
    let a = 0.4 * i
    while (a > Math.PI / 2) a -= Math.PI
    raw.push(a)
  }
  const uw = unwrapAxis(raw)
  const f = linFit(uw.map((_, i) => i), uw)
  assert.ok(Math.abs(f.slope - 0.4) < 1e-6 && f.r2 > 0.999, `slope=${f.slope}`)
})

// --- round-trip: forward physics -> series -> recovered environment ---

test('recovers still air vs. a crosswind (speed and direction)', () => {
  const calm = analyze({ windMs: 0, film: 2 })
  assert.ok(calm.windSpeedMs < 0.6, `calm should read still: ${calm.windSpeedMs}`)

  const windy = analyze({ windMs: 4, film: 2 })
  assert.ok(windy.windSpeedMs > 1.5, `wind should register: ${windy.windSpeedMs}`)
  assert.equal(windy.windDirDeg, 0, 'wind blowing +x should read left→right')

  const other = analyze({ windMs: -4, film: 2 })
  assert.equal(other.windDirDeg, 180, 'reversed wind should read right→left')
})

test('distinguishes a string-loop launch from a rigid-wand launch', () => {
  assert.equal(analyze({ launcher: 'loop', sep: 0.7, windMs: 3 }).launcher, 'string loop')
  assert.equal(analyze({ launcher: 'wand', windMs: 3 }).launcher, 'rigid wand')
})

test('detects film ringing: a thin film rings, a thick one does not', () => {
  assert.equal(analyze({ launcher: 'loop', sep: 0.6, film: 0.4 }).ringing, true)
  assert.equal(analyze({ launcher: 'loop', sep: 0.6, film: 3 }).ringing, false)
})

test('recovers the spin rate and flags it', () => {
  const r = analyze({ launcher: 'wand', spin: 3, windMs: 3 })
  assert.equal(r.spinning, true)
  assert.ok(Math.abs(r.spinRate - 3) < 1, `spin ≈ 3 rad/s: ${r.spinRate}`)

  assert.equal(analyze({ launcher: 'wand', spin: 0, windMs: 3 }).spinning, false)
})

test('senses gravity from the downward acceleration', () => {
  assert.ok(analyze({ gravity: 12, windMs: 2 }).gravityAccel > 8, 'a falling bubble should show downward acceleration')
  assert.ok(analyze({ gravity: 0, windMs: 2 }).gravityAccel < 8, 'a weightless bubble should not')
})

test('produces human-readable findings and a confidence', () => {
  const r = analyze({ windMs: 4, launcher: 'loop', sep: 0.7, film: 0.5 })
  assert.ok(r.ok && Array.isArray(r.findings) && r.findings.length >= 3)
  assert.ok(r.confidence >= 0 && r.confidence <= 1)
  assert.ok(r.findings.some((s) => /loop/i.test(s)), 'should mention the loop launch')
})

test('degrades gracefully on too few frames', () => {
  const r = analyzeSeries([{ t: 0, D: 0, chi: 1, angle: 0, area: 1, cx: 0, cy: 0 }], { pxPerMs: PX })
  assert.equal(r.ok, false)
})
