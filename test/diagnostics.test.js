import test from 'node:test'
import assert from 'node:assert/strict'
import { groups, coachBubble, ringSignature, GOALS, MODEL_GAPS } from '../src/lib/diagnostics.js'

test('Weber & Bond grow with wind and size', () => {
  const base = groups({ diameterCm: 12, windMs: 3, sigma: 0.03 })
  assert.ok(groups({ diameterCm: 12, windMs: 6, sigma: 0.03 }).We > base.We, 'We rises with wind')
  assert.ok(groups({ diameterCm: 24, windMs: 3, sigma: 0.03 }).We > base.We, 'We rises with size')
  assert.ok(groups({ diameterCm: 24, windMs: 3, sigma: 0.03 }).Bo > base.Bo, 'Bo rises with size')
  assert.ok(groups({ diameterCm: 12, windMs: 3, sigma: 0.05 }).We < base.We, 'higher σ lowers We')
})

test('every goal returns a scored, actionable plan', () => {
  const obs = { diameterCm: 20, windMs: 3, launcher: 'loop', filmUm: 1, ring: { rings: true, hz: 2 } }
  for (const g of GOALS) {
    const r = coachBubble(obs, g.key)
    assert.equal(r.goal.key, g.key)
    assert.ok(r.score >= 0 && r.score <= 100, `score in range for ${g.key}: ${r.score}`)
    assert.ok(r.levers.length >= 3, `${g.key} gives ≥3 levers`)
    assert.ok(r.levers.every((l) => l.title && l.why), `${g.key} levers are complete`)
    assert.ok(typeof r.summary === 'string' && r.summary.length > 0)
  }
})

test('goal-specific advice names the right levers', () => {
  const obs = { diameterCm: 20, windMs: 4, launcher: 'loop', filmUm: 1 }
  const text = (r) => (r.summary + ' ' + r.levers.map((l) => l.title + ' ' + l.control + ' ' + l.why).join(' ')).toLowerCase()
  assert.match(text(coachBubble(obs, 'bigger')), /loop|opening|surface tension|σ/)
  assert.match(text(coachBubble(obs, 'longer')), /drain|film|humid|evaporat/)
  assert.match(text(coachBubble(obs, 'faster')), /wind|downwind|smaller|lighter/)
  assert.match(text(coachBubble(obs, 'harder')), /weber|smaller|tension|σ/)
})

test('sturdiness score rewards low Weber (small, calm)', () => {
  const calmSmall = coachBubble({ diameterCm: 8, windMs: 1 }, 'harder').score
  const windyBig = coachBubble({ diameterCm: 30, windMs: 7 }, 'harder').score
  assert.ok(calmSmall > windyBig, `small+calm should be sturdier: ${calmSmall} vs ${windyBig}`)
})

test('bigger score rewards larger diameter', () => {
  assert.ok(coachBubble({ diameterCm: 32 }, 'bigger').score > coachBubble({ diameterCm: 10 }, 'bigger').score)
})

test('the ring signature separates a thin (ringing) film from a thick one', () => {
  assert.equal(ringSignature({ R: 70, mass: 0.7 }).rings, true)
  assert.equal(ringSignature({ R: 70, mass: 2.3 }).rings, false)
})

test('model gaps are surfaced as hypotheses', () => {
  assert.ok(MODEL_GAPS.length >= 3 && MODEL_GAPS.every((s) => typeof s === 'string'))
})
