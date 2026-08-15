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
 * everyday 2–8 m/s range (it barely deforms). The film's *lifetime*, though, is
 * now a real modelled quantity — the wall drains, evaporates, and (with wind)
 * loses water convectively until it ruptures — so "how long will it last?" is
 * measured, not guessed. The effects still missing are surfaced explicitly as
 * `MODEL_GAPS`: the next hypotheses worth adding.
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
    step(b, dt, { windX: 0, windY: 0, gravity: 0, mass: cfg.mass || 1, kSpring: cfg.kSpring || 260, kPressure: cfg.kPressure || 90, elasticity: cfg.elasticity || 0 })
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

/**
 * Bubble lifetime (seconds): fly a bubble with a draining wall and time how long
 * until it ruptures. In still air (windMs 0) this is the film's baseline life;
 * pass a windMs (and windThinning) to measure how much a real breeze cuts it —
 * moving air sweeps the humid boundary layer off the film and speeds evaporation.
 * Either way it's a real, measured quantity — the answer to "how long will it
 * last?".
 */
export function bubbleLifetime(
  cfg,
  { thickness = 1000, drainage = 220, evaporation = 18, windMs = 0, windThinning = 0, elasticity = 0, buoyancy = 0, cap = 120, pxPerMs = 26 } = {},
) {
  const b = createBubble({ R: cfg.R || 70, n: 56, thickness })
  const dt = 1 / 60
  const wx = windMs * pxPerMs
  for (let t = 0; t < cap; t += dt) {
    step(b, dt, { windX: wx, windY: 0, gravity: 10, buoyancy, mass: cfg.mass || 1, drainage, evaporation, windThinning, elasticity })
    if (b.popped) return t
  }
  return cap
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
// (Drainage, evaporation, convective wind loss, film weight/buoyancy and
// surfactant elasticity are now all modelled — so these are what's still open.)
export const MODEL_GAPS = [
  'Enclosed-gas density: POP fills the bubble with ambient air, so it only ever sinks or hangs — a warm breath or a lighter gas would make it rise, which POP can\'t show yet.',
  'Marginal regeneration & temperature: real drainage is patchy (thin patches race up the film) and temperature-dependent; POP uses a smooth, uniform thinning law.',
  'Thin-film interference colour: a real film\'s swirling colours read out its thickness directly; POP tracks thickness as a number but doesn\'t render those tell-tale colours.',
  'Lumped surfactant: POP folds a mix\'s whole chemistry into one "elasticity" knob (heals + drains slower); real Marangoni flows and evaporation-driven gradients are richer than that.',
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
    const life = o.lifetimeS // measured still-air seconds-to-rupture, if provided
    const lifeWind = o.lifetimeWindS // measured seconds in the observed wind, if provided
    const scoreLife = lifeWind != null ? lifeWind : life // score the life it actually gets
    score = clamp(scoreLife != null ? (scoreLife / 30) * 100 : 70 - o.windMs * 8) // 30 s ≈ "long"
    const windCost = life != null && lifeWind != null ? Math.max(0, Math.round((1 - lifeWind / Math.max(life, 1e-6)) * 100)) : 0
    summary =
      lifeWind != null && life != null
        ? `POP timed the wall draining: ≈ ${life.toFixed(0)} s in still air, but only ≈ ${lifeWind.toFixed(0)} s in this ${o.windMs.toFixed(1)} m/s wind (${windCost}% shorter) — moving air sweeps the humid layer off the film and speeds evaporation. Thickness, dryness and calm air are the big levers.`
        : life != null
          ? `POP flew it in still air and timed the wall draining: it lasts ≈ ${life.toFixed(0)} s before rupturing. Thickness and dryness are the big levers.`
          : `The film's drainage sets its life — thicker, conditioned films in humid air last far longer.`
    levers = [
      { title: 'Thicken the film and condition the mix (add glycerin)', control: 'Film & Mix', why: 'A thicker wall starts further from the rupture limit, and a conditioned (elastic) mix drains and evaporates slower — together the single biggest lever.' },
      { title: 'Move to more humid air', control: 'Humidity', why: 'Dry air evaporates the wall faster; humidity slows it and directly extends the timed life.' },
      { title: 'Get it out of the wind — or let it ride with the breeze', control: 'Wind', why: `Wind only drains the film while air is moving across it: a bubble carried along with a steady breeze feels almost none, but a gust it can't keep up with sweeps water off fast${windCost ? ` (worth ≈ ${windCost}% of its life here)` : ''}.` },
      { title: 'Pick a moderate size', control: 'Size', why: 'Very large films drain and sag quickly; a mid size lasts longer while still looking good.' },
    ]
  } else if (goalKey === 'faster') {
    score = clamp(o.windMs * 12 + (o.diameterCm < 12 ? 20 : 0))
    summary = `A bubble travels at the wind speed minus its slip. It's in ≈ ${o.windMs.toFixed(1)} m/s of wind; smaller, lighter bubbles couple to the flow soonest.`
    levers = [
      { title: 'Launch with the wind, not across it', control: 'Direction', why: 'Going downwind adds the airflow to your launch instead of fighting it.' },
      { title: 'Make it smaller & lighter', control: 'Size / Film', why: 'Less inertia and drag area → it reaches wind speed in fewer bubble-lengths. A thin, light film also hangs in the air to be carried, where a heavy one sinks out of the wind.' },
      { title: 'Use a stronger, steady wind', control: 'Wind', why: `Advection speed tracks the wind — but watch deformation as We climbs (now ${We.toFixed(2)}).` },
    ]
  } else {
    // harder / sturdier — low Weber ⇒ hard to deform. Soft-clamped so it stays
    // discriminating across the realistic range (We of a hand-sized bubble in a
    // breeze is naturally tens), rather than saturating at 0.
    score = clamp((100 * 5) / (5 + We))
    summary = `Sturdiness is a low Weber number: We = ρU²R/σ ≈ ${We.toFixed(2)} (${We < 0.3 ? 'robust' : We < 0.8 ? 'moderate' : 'easily distorted'}).`
    levers = [
      { title: 'Use a conditioned mix (glycerin / good detergent)', control: 'Mix', why: 'Surfactant elasticity heals thin spots as they form, so the film tolerates far more stretch before it bursts — the sturdiest change you can make to the liquid itself.' },
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
