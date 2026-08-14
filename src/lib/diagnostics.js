/**
 * Bubble diagnostics & coach.
 *
 * Given an observed bubble (what a video would tell you: size, the wind it's in,
 * its launcher, its film "ring", any spin) and a goal — **bigger, longer-lasting,
 * faster, or harder (sturdier)** — recommend concrete, physics-grounded levers to
 * do better, and score where the bubble sits today.
 *
 * The advice is built on the established dimensionless groups rather than the
 * soft-body engine's tuning, because the engine is deliberately stiff in the
 * everyday 2–8 m/s range (it barely deforms, and — a real model gap — its fall
 * speed is mass-independent and it has no film-drainage lifetime). Those gaps are
 * surfaced explicitly as `MODEL_GAPS`: the next hypotheses worth adding.
 *
 *   We = ρ U² R / σ   (aerodynamic stress vs. surface tension — deformation & pop)
 *   Bo = ρ g R² / σ   (gravity vs. surface tension — sag & size limit)
 */

import { createBubble, step, measure, driftVelocity } from './engine.js'

// ---- objective measurements from the engine (characterise a real film) ----

/**
 * Ring signature: pinch the bubble and watch it relax. A light/thin film
 * overshoots and rings; a heavy/thick one oozes back. Returns whether it rings,
 * the ring frequency (Hz) and the settle time (s). This one IS discriminating,
 * so it's a genuine read on the film's inertia.
 */
export function ringSignature(cfg) {
  const b = createBubble({ R: cfg.R || 70, n: 56, squash: 0.35 })
  const dt = 1 / 120
  const Ds = []
  const ts = []
  for (let t = 0; t < 2.4; t += dt) {
    step(b, dt, { windX: 0, windY: 0, gravity: 0, mass: cfg.mass || 1, kSpring: cfg.kSpring || 260, kPressure: cfg.kPressure || 90 })
    Ds.push(measure(b).D)
    ts.push(t)
  }
  let minIdx = -1
  for (let i = 3; i < Ds.length - 3; i++) {
    if (Ds[i] < Ds[i - 3] && Ds[i] <= Ds[i + 3]) { minIdx = i; break }
  }
  const rings = minIdx >= 0 && Math.max(...Ds.slice(minIdx)) > Ds[minIdx] + 0.03
  const hz = minIdx > 0 ? 0.25 / ts[minIdx] : 0
  let settle = ts[ts.length - 1]
  for (let i = Ds.length - 1; i > 0; i--) {
    if (Ds[i] > 0.05) { settle = ts[i]; break }
  }
  return { rings, hz, settleTime: settle }
}

/** How well the bubble couples to the wind: its drift speed as a fraction of the
 * wind after ~1.5 s. Near 1 = it's carried along (fast); low = it lags. */
export function windCoupling(cfg, windMs, { pxPerMs = 26 } = {}) {
  const b = createBubble({ R: cfg.R || 70, n: 56 })
  const wx = windMs * pxPerMs
  const dt = 1 / 120
  for (let t = 0; t < 1.6; t += dt) step(b, dt, { windX: wx, windY: 0, gravity: 10, mass: cfg.mass || 1 })
  const d = driftVelocity(b)
  return wx > 1e-6 ? Math.max(0, Math.min(1, d.vx / wx)) : 0
}

// ---- dimensionless groups from an observation (physical, in SI-ish units) ----

/**
 * Weber and Bond numbers for an observed bubble. Sizes come in as a display
 * diameter in cm; wind in m/s; surface tension in N/m. These set the physics of
 * every recommendation below.
 */
export function groups({ diameterCm = 12, windMs = 3, sigma = 0.03, rho = 1.2, g = 9.81 }) {
  const R = (diameterCm / 100) / 2 // m
  const We = (rho * windMs * windMs * R) / sigma
  const Bo = (rho * g * R * R) / sigma
  return { We, Bo, R }
}

export const GOALS = [
  { key: 'bigger', label: 'Bigger', icon: '⚪' },
  { key: 'longer', label: 'Longer-lasting', icon: '⏳' },
  { key: 'faster', label: 'Faster', icon: '💨' },
  { key: 'harder', label: 'Sturdier', icon: '🛡️' },
]

// Effects the live engine does NOT capture yet — the hypotheses to add next.
export const MODEL_GAPS = [
  'Lifetime / film drainage: real bubbles pop from the wall thinning and draining under gravity, not from wind alone. This is the single biggest driver of "longer-lasting" and POP does not simulate it yet.',
  'Evaporation & humidity: dry air thins the film faster; humidity should extend life. Untracked.',
  'Buoyancy vs. film weight: POP\'s fall speed is currently mass-independent, so "floaty vs. heavy" can\'t be read from it — adding real film mass & buoyancy would fix that.',
  'Surfactant (Marangoni) elasticity: surface-tension gradients stiffen the film dynamically and likely explain why some mixes are far sturdier.',
]

/**
 * Coach: rank concrete levers to move an observed bubble toward a goal.
 * @param {object} obs  { diameterCm, windMs, sigma, launcher, filmUm, ring, spinRate }
 * @param {string} goalKey  one of GOALS[].key
 */
export function coachBubble(obs, goalKey) {
  const o = { diameterCm: 12, windMs: 3, sigma: 0.03, launcher: 'loop', filmUm: 1, spinRate: 0, ...obs }
  const { We, Bo } = groups(o)
  const goal = GOALS.find((g) => g.key === goalKey) || GOALS[0]

  const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)))
  let score = 50
  let summary = ''
  let levers = []
  let caveat = null

  if (goalKey === 'bigger') {
    score = clamp((o.diameterCm / 40) * 100) // 40 cm ≈ "big"
    summary = `≈ ${o.diameterCm.toFixed(0)} cm across. Size is set at birth by the opening and inflated by airflow; the limit is surface tension holding the film together (Bo ≈ ${Bo.toFixed(1)}).`
    levers = [
      { title: 'Widen the loop opening', control: 'Custom loop → Handles', why: 'The opening area sets the birth size — a bigger loop makes a bigger bubble.' },
      { title: 'Launch into gentle, steady airflow', control: 'Wind', why: 'Moving air billows the loop open and inflates the film — how giant bubbles are actually made. Keep it steady; gusts burst big films first.' },
      { title: 'Raise surface tension / soapier, conditioned mix', control: 'σ (Tension)', why: `A larger film needs more σ to resist gravity drainage — Bo = ρgR²/σ grows with size², and it's already ${Bo.toFixed(1)}.` },
      { title: 'Keep the wind low & smooth', control: 'Wind / Gust', why: `Aerodynamic stress We = ρU²R/σ rises with size; big bubbles distort and pop first (We ≈ ${We.toFixed(2)} now).` },
    ]
  } else if (goalKey === 'longer') {
    score = clamp(70 - o.windMs * 8) // calmer air ⇒ longer
    summary = `The wind it's in (≈ ${o.windMs.toFixed(1)} m/s) and the film's drainage set its life. Lifetime is dominated by the wall thinning — which POP doesn't yet simulate.`
    levers = [
      { title: 'Thicken & condition the film (add glycerin)', control: 'Film', why: 'Lifetime is set by drainage and evaporation — thicker, conditioned films drain far slower. This is the biggest lever and the one the live model does not capture.' },
      { title: 'Move to calmer, more humid air', control: 'Wind', why: 'Wind stress and dry air thin and rupture the wall; humidity slows evaporation.' },
      { title: 'Pick a moderate size', control: 'Size', why: 'Very large films drain and sag quickly; a mid size lasts longer while still looking good.' },
    ]
    caveat = 'POP has no drainage/evaporation model yet, so it can\'t simulate lifetime directly — this advice is from the established film physics.'
  } else if (goalKey === 'faster') {
    score = clamp(o.windMs * 12 + (o.diameterCm < 12 ? 20 : 0))
    summary = `A bubble travels at the wind speed minus its slip. It's in ≈ ${o.windMs.toFixed(1)} m/s of wind; smaller, lighter bubbles couple to the flow soonest.`
    levers = [
      { title: 'Launch with the wind, not across it', control: 'Direction', why: 'Going downwind adds the airflow to your launch instead of fighting it.' },
      { title: 'Make it smaller & lighter', control: 'Size / Film', why: 'Less inertia and drag area → it reaches wind speed in fewer bubble-lengths.' },
      { title: 'Use a stronger, steady wind', control: 'Wind', why: `Advection speed tracks the wind — but watch deformation as We climbs (now ${We.toFixed(2)}).` },
    ]
  } else {
    // harder / sturdier — low Weber ⇒ hard to deform. Soft-clamped so it stays
    // discriminating across the realistic range (We of a hand-sized bubble in a
    // breeze is naturally tens), rather than saturating at 0.
    score = clamp((100 * 5) / (5 + We))
    summary = `Sturdiness is a low Weber number: We = ρU²R/σ ≈ ${We.toFixed(2)} (${We < 0.3 ? 'robust' : We < 0.8 ? 'moderate' : 'easily distorted'}).`
    levers = [
      { title: 'Make it smaller', control: 'Size', why: 'We falls linearly with radius — a small bubble shrugs off wind that distorts a big one.' },
      { title: 'Raise surface tension', control: 'σ (Tension)', why: 'σ is the restoring force; more of it directly lowers We and stiffens the film.' },
      { title: 'Thicken the film', control: 'Film', why: `More membrane inertia damps fast gust wobbles (it ${o.ring && o.ring.rings ? `rings at ~${o.ring.hz.toFixed(1)} Hz now` : 'already resists ringing'}).` },
      { title: 'Stay out of strong, gusty wind', control: 'Wind / Gust', why: 'Lower relative wind is the most direct way to cut We.' },
    ]
    if (o.spinRate && Math.abs(o.spinRate) > 0.5) {
      levers.push({ title: 'Note: it\'s spinning', control: 'Spin', why: 'Whether spin spreads stress and helps or hurts sturdiness is an open question worth testing.' })
    }
  }

  return { goal, score, summary, levers, caveat }
}
