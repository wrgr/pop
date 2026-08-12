/**
 * Bubble forensics — the *inverse* of the physics engine.
 *
 * A single silhouette is ambiguous: wind, gravity sag, film ringing, the
 * launcher's imprint, a wake and spin all leave an elongated blob and can't be
 * told apart from one frame. The way out is to go the other way — read a
 * *series* of shapes over time and let each cue reveal itself by its distinct
 * time signature:
 *
 *   • Wind      → a steady drift of the centroid (and a sustained deformation).
 *   • Gravity   → a downward *acceleration* of the centroid (curvature in y).
 *   • Launcher  → an *initial* elongation that decays: a big, fading D at birth
 *                 means a compliant string loop stamped the bubble; a small,
 *                 steady D from the start means a rigid wand.
 *   • Film      → *ringing*: the launch imprint oscillates as it relaxes; the
 *                 period scales with the film's inertia (thickness).
 *   • Spin      → the measured major-axis angle *advances* steadily.
 *
 * `analyzeSeries` takes the shape time-series a video (or burst of photos) would
 * yield and returns those inferred quantities with a confidence. It is the
 * literal answer to "can you go from a series of bubble pictures back to the
 * environment?" — yes, far more than from any one of them.
 *
 * Frames: [{ t, D, chi, angle, area, cx, cy }] with t in seconds, lengths in px.
 */

/** Ordinary least-squares line fit y = slope·x + intercept, with R². */
export function linFit(xs, ys) {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 }
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
  }
  const d = n * sxx - sx * sx
  const slope = d !== 0 ? (n * sxy - sx * sy) / d : 0
  const intercept = (sy - slope * sx) / n
  const meanY = sy / n
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept
    ssRes += (ys[i] - pred) ** 2
    ssTot += (ys[i] - meanY) ** 2
  }
  return { slope, intercept, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 }
}

/** Least-squares quadratic y = a + b·t + c·t²; returns {a, b, c}. */
export function quadFit(ts, ys) {
  const n = ts.length
  if (n < 3) return { a: ys[0] || 0, b: 0, c: 0 }
  // Normal equations for [a, b, c] against basis [1, t, t²].
  let S0 = n
  let S1 = 0
  let S2 = 0
  let S3 = 0
  let S4 = 0
  let T0 = 0
  let T1 = 0
  let T2 = 0
  for (let i = 0; i < n; i++) {
    const t = ts[i]
    const t2 = t * t
    S1 += t
    S2 += t2
    S3 += t2 * t
    S4 += t2 * t2
    T0 += ys[i]
    T1 += ys[i] * t
    T2 += ys[i] * t2
  }
  // Solve the 3×3 system by Cramer's rule.
  const A = [
    [S0, S1, S2],
    [S1, S2, S3],
    [S2, S3, S4],
  ]
  const rhs = [T0, T1, T2]
  const det3 = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const D = det3(A)
  if (Math.abs(D) < 1e-9) return { a: T0 / n, b: 0, c: 0 }
  const col = (A, rhs, k) => A.map((row, i) => row.map((v, j) => (j === k ? rhs[i] : v)))
  return {
    a: det3(col(A, rhs, 0)) / D,
    b: det3(col(A, rhs, 1)) / D,
    c: det3(col(A, rhs, 2)) / D,
  }
}

/**
 * Unwrap a series of principal-axis angles. PCA orientation is defined only
 * modulo π (a bar and the same bar flipped are identical), so we unwrap with
 * period π rather than 2π; the result is a continuous angle whose slope is the
 * true rotation rate of the shape.
 */
export function unwrapAxis(angles) {
  const out = [angles[0]]
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1]
    while (d > Math.PI / 2) d -= Math.PI
    while (d < -Math.PI / 2) d += Math.PI
    out.push(out[i - 1] + d)
  }
  return out
}

/**
 * Recover the environment and launch conditions from a shape time-series.
 *
 * @param {Array} frames  [{t, D, chi, angle, area, cx, cy}] (t↑, px units)
 * @param {object} opts
 * @param {number} opts.pxPerMs  px/s per m/s, to report wind in m/s.
 * @param {number} opts.kCal     shape→Weber→relative-wind calibration (px units).
 * @returns {object} inferred quantities + confidence + human-readable findings.
 */
export function analyzeSeries(frames, { pxPerMs = 26, kCal = 1.3e-4 } = {}) {
  if (!frames || frames.length < 4) {
    return { ok: false, reason: 'need at least 4 frames', findings: ['Too few frames to infer anything.'] }
  }
  const ts = frames.map((f) => f.t)
  const T = ts[ts.length - 1] - ts[0]

  // --- Wind: the bubble is advected toward the wind but lags it. Its own late
  // drift velocity is the part of the wind it has caught up to; the *relative*
  // wind still crossing the film shows up as the sustained deformation. The true
  // wind is the sum: wind = bubble_drift + relative_wind. ---
  const late = frames.slice(Math.floor(frames.length * 0.6)) // once it has caught up to the flow
  const lateFit = { x: linFit(late.map((f) => f.t), late.map((f) => f.cx)) }
  const driftVx = lateFit.x.slope // px/s, the bubble's own horizontal drift

  const driftMs = Math.abs(driftVx) / pxPerMs
  const settledD = median(late.map((f) => f.D))
  const windDirDeg = driftVx >= 0 ? 0 : 180 // horizontal wind sign (demo winds are horizontal)

  // --- Gravity: a steady downward pull shows up as the vertical velocity
  // *growing* over the flight. Comparing an early and a late window of cy(t)
  // isolates that acceleration from the one-off launch kick. ---
  const t0 = ts[0]
  const earlyG = frames.filter((f) => f.t - t0 > 0.3 && f.t - t0 < 0.8)
  const lateG = frames.filter((f) => f.t - t0 >= 0.9)
  let gravityAccel = 0
  if (earlyG.length > 2 && lateG.length > 2) {
    const vyEarly = linFit(earlyG.map((f) => f.t), earlyG.map((f) => f.cy)).slope
    const vyLate = linFit(lateG.map((f) => f.t), lateG.map((f) => f.cy)).slope
    const tEarly = earlyG[Math.floor(earlyG.length / 2)].t
    const tLate = lateG[Math.floor(lateG.length / 2)].t
    gravityAccel = tLate > tEarly ? (vyLate - vyEarly) / (tLate - tEarly) : 0
  }

  // --- Launcher: does the birth elongation decay? ---
  const early = frames.slice(0, Math.max(2, Math.floor(frames.length * 0.18)))
  const initialD = median(early.map((f) => f.D))
  const launcherIsLoop = initialD > settledD + 0.06 && initialD > 0.12
  const launcher = launcherIsLoop ? 'string loop' : 'rigid wand'

  // --- Wind speed. The clean signal is the horizontal *drift*: the bubble is
  // advected toward the wind (it lags, so this is a lower bound). We refine it
  // with the relative wind read from the sustained deformation ONLY when the
  // shape is wind-clean — a lingering launcher imprint would otherwise be
  // misread as a huge wind. ---
  const We = settledD > 0 && settledD < 0.32 ? settledD / (0.24 - 0.75 * settledD) : null
  const relWindMs = We != null ? Math.sqrt(We / kCal) / pxPerMs : 0
  const shapeIsWindClean = !launcherIsLoop // no imprint left in the back half
  const windSpeedMs = driftMs > 0.5 ? driftMs + (shapeIsWindClean ? relWindMs : 0) : driftMs

  // --- Film / ringing: oscillation of D(t) in the first ~second. ---
  const ring = detectRinging(frames)

  // --- Spin: steady advance of the principal-axis angle. ---
  const uw = unwrapAxis(frames.map((f) => f.angle))
  const spinFit = linFit(ts, uw)
  const spinning = Math.abs(spinFit.slope) > 0.4 && spinFit.r2 > 0.9
  const spinRate = spinning ? spinFit.slope : 0

  // --- Confidence: more frames, longer window, cleaner drift ⇒ higher. ---
  const confidence = clamp01(0.25 * Math.min(1, frames.length / 40) + 0.35 * Math.min(1, T / 1.5) + 0.4 * lateFit.x.r2)

  const findings = []
  findings.push(
    windSpeedMs > 0.3
      ? `Wind ≈ ${windSpeedMs.toFixed(1)} m/s blowing ${windDirDeg === 0 ? 'left → right' : 'right → left'}${
          !shapeIsWindClean ? ' (a lower bound — the launcher imprint is still relaxing)' : ''
        }.`
      : 'Air is nearly still — the bubble barely drifts.',
  )
  if (!spinning) {
    findings.push(
      gravityAccel > 8
        ? `Gravity is pulling it down (≈ ${gravityAccel.toFixed(0)} px/s² of downward acceleration).`
        : 'Little net fall — the bubble is nearly neutrally buoyant.',
    )
  }
  findings.push(
    launcherIsLoop
      ? `Launched from a string loop: it was born elongated (D≈${initialD.toFixed(2)}) and relaxed to D≈${settledD.toFixed(2)}.`
      : `Launched from a rigid wand: round from the start (D≈${initialD.toFixed(2)}), no fading imprint.`,
  )
  if (ring.rings) {
    findings.push(
      'The film is light enough that its launch imprint overshoots and rings out, rather than settling smoothly — a thinner, lower-inertia film.',
    )
  }
  if (spinning) {
    findings.push(
      `The bubble is spinning at ≈ ${Math.abs(spinRate).toFixed(1)} rad/s — its tilt is rotating, not fixed by wind (so the wind direction here is unreliable).`,
    )
  }

  return {
    ok: true,
    windSpeedMs,
    windDirDeg,
    relWindMs,
    gravityAccel,
    launcher,
    launcherIsLoop,
    initialD,
    settledD,
    ringing: ring.rings,
    ringHz: ring.hz,
    spinning,
    spinRate,
    confidence,
    findings,
  }
}

// --- helpers ---

function median(a) {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

/**
 * Detect ringing in D(t). A heavy film relaxes its launch imprint monotonically;
 * a light film *overshoots* — D falls, dips through a minimum, then rebounds.
 * That one rebound is the signature. We find the first interior minimum and
 * check D climbs back above it by a margin; the time to that minimum is a
 * quarter-period of the oscillation, giving a frequency (a lighter/thinner film
 * rings faster, so the minimum comes sooner).
 */
function detectRinging(frames) {
  if (frames.length < 8) return { rings: false, hz: 0 }
  const D = frames.map((f) => f.D)
  const ts = frames.map((f) => f.t)
  // First interior local minimum (coarse ±3 comparison to ignore sampling noise).
  let minIdx = -1
  for (let i = 3; i < D.length - 3; i++) {
    if (D[i] < D[i - 3] && D[i] <= D[i + 3]) {
      minIdx = i
      break
    }
  }
  if (minIdx < 0) return { rings: false, hz: 0 }
  const laterMax = Math.max(...D.slice(minIdx))
  if (laterMax < D[minIdx] + 0.03) return { rings: false, hz: 0 } // no real rebound
  const quarter = ts[minIdx] - ts[0]
  return { rings: true, hz: quarter > 0 ? 0.25 / quarter : 0 }
}
