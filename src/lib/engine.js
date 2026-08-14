/**
 * POP soft-body bubble physics engine.
 *
 * The rest of POP asks a single question: can the *shape* of a bubble tell you
 * how the wind was blowing?  Until now the "simulator" answered that with a
 * closed-form ellipse — it never actually let a bubble move.  This module is a
 * small but real physics engine so the deformation is *emergent* instead of
 * assumed: a soap film is modelled as a closed ring of point masses joined by
 * surface-tension springs, held open by an internal air-pressure constraint,
 * and pushed around by an aerodynamic wind model.  We integrate the whole thing
 * forward in time; the ellipse you see is whatever shape those forces settle
 * into.  Downstream code can then measure that shape and try to recover the
 * wind — the same inverse problem POP is built around.
 *
 * Everything is in "sim units" (pixels for length, seconds for time).  The
 * constants are tuned for a legible on-screen bubble rather than SI metrology,
 * which is consistent with POP being a teaching tool.  The *structure* of the
 * forces, however, is physical: Hookean surface tension, a pressure that scales
 * with area error, stagnation pressure on the windward face, and linear drag.
 */

const TWO_PI = Math.PI * 2

/**
 * Build a fresh bubble: `n` nodes evenly spaced on a circle of radius `R`.
 * Each node carries a position and a velocity.  We remember the rest edge
 * length and rest area so the springs and pressure term have a target to hold.
 *
 * @param {object} opts
 * @param {number} opts.cx  Centre x (px)
 * @param {number} opts.cy  Centre y (px)
 * @param {number} opts.R   Radius (px)
 * @param {number} opts.n   Node count (membrane resolution)
 * @param {number} opts.vx  Initial launch velocity x (px/s)
 * @param {number} opts.vy  Initial launch velocity y (px/s)
 */
export function createBubble({ cx = 360, cy = 200, R = 70, n = 56, vx = 0, vy = 0, squash = 0, tilt = 0, thickness = null } = {}) {
  // `squash` pre-deforms the ring into an ellipse: a real bubble pinches off the
  // launcher and is born already distorted, so with light damping it rings (its
  // Rayleigh–Lamb shape mode) as it relaxes. Area is preserved (stretch one
  // axis, shrink the other by the same factor). `tilt` (radians) rotates that
  // initial ellipse, so a launcher can imprint an elongation at any angle.
  const sx = 1 + squash
  const sy = 1 / sx
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const nodes = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TWO_PI
    const dx = Math.cos(th) * R * sx
    const dy = Math.sin(th) * R * sy
    nodes.push({
      x: cx + dx * ct - dy * st,
      y: cy + dx * st + dy * ct,
      vx,
      vy,
    })
  }
  return {
    nodes,
    n,
    R0: R,
    restLen: (TWO_PI * R) / n,
    restArea: Math.PI * R * R,
    // Film wall thickness (nm), if lifetime is being simulated; null = no drainage.
    thickness,
    // Diagnostics filled in by measure(); handy for the UI.
    age: 0,
    popped: false,
    popReason: null, // 'deformed' (over-stretched by wind) | 'drained' (film ruptured)
  }
}

/** Signed polygon area via the shoelace formula (positive for CCW winding). */
export function polygonArea(nodes) {
  let a = 0
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const p = nodes[i]
    const q = nodes[(i + 1) % n]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/** Area-weighted centroid of the membrane polygon. */
export function centroid(nodes) {
  let cx = 0
  let cy = 0
  let a = 0
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const p = nodes[i]
    const q = nodes[(i + 1) % n]
    const cross = p.x * q.y - q.x * p.y
    a += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  a *= 0.5
  if (Math.abs(a) < 1e-9) {
    // Degenerate — fall back to the vertex mean.
    let mx = 0
    let my = 0
    for (const p of nodes) {
      mx += p.x
      my += p.y
    }
    return { x: mx / n, y: my / n }
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

/**
 * Measure the current bubble shape with principal-component analysis so the
 * result is orientation-free.  Returns the major/minor semi-axes, tilt angle,
 * the Taylor deformation parameter D = (a-b)/(a+b), the axis ratio, the
 * centroid and the enclosed area.  This is the bridge back to POP's inference
 * layer: feed `D` into `weberFromDeformation` to recover the wind.
 */
export function measure(state) {
  const { nodes } = state
  const c = centroid(nodes)
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of nodes) {
    const dx = p.x - c.x
    const dy = p.y - c.y
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const n = nodes.length
  sxx /= n
  syy /= n
  sxy /= n

  // Eigenvalues of the 2x2 covariance matrix.
  const tr = sxx + syy
  const det = sxx * syy - sxy * sxy
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  const l1 = tr / 2 + disc // larger
  const l2 = Math.max(1e-9, tr / 2 - disc) // smaller

  // For an ellipse the variance eigenvalues are (semiaxis^2)/4, so the ratio of
  // semi-axes is sqrt(l1/l2).  Scale to real pixel semi-axes using the radius
  // of gyration relation (semi-axis = 2*sqrt(eigenvalue)).
  const a = 2 * Math.sqrt(l1)
  const b = 2 * Math.sqrt(l2)
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)

  const D = (a - b) / (a + b)
  const chi = a / b
  return {
    a,
    b,
    angle,
    D,
    chi,
    centroid: c,
    area: Math.abs(polygonArea(nodes)),
  }
}

/**
 * Outward unit normals at each node, taken as the normalised average of the two
 * adjacent edge normals.  Assumes counter-clockwise winding (screen space with
 * y-down makes our CCW ring wind clockwise visually, but the math is
 * self-consistent because we derive the sign from the signed area below).
 */
function nodeNormals(nodes, sign) {
  const n = nodes.length
  const normals = new Array(n)
  const lengths = new Array(n)
  for (let i = 0; i < n; i++) {
    const prev = nodes[(i - 1 + n) % n]
    const cur = nodes[i]
    const next = nodes[(i + 1) % n]

    // Edge vectors around this node.
    const e1x = cur.x - prev.x
    const e1y = cur.y - prev.y
    const e2x = next.x - cur.x
    const e2y = next.y - cur.y

    // Normal to an edge (dx,dy) is (dy,-dx); multiply by winding sign so it
    // points outward regardless of orientation.
    let nx = (e1y + e2y) * sign
    let ny = -(e1x + e2x) * sign
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    normals[i] = { x: nx, y: ny }
    // "Exposed length" this node represents (half of each adjacent edge).
    lengths[i] = 0.5 * (Math.hypot(e1x, e1y) + Math.hypot(e2x, e2y))
  }
  return { normals, lengths }
}

/**
 * Advance the simulation by `dt` seconds.  Uses semi-implicit (symplectic)
 * Euler with internal sub-stepping for stability under stiff springs.
 *
 * Force model, per node:
 *   1. Surface tension — Hookean springs to the two neighbours, pulling the
 *      perimeter back to its rest length (a film wants to be small/round).
 *   2. Internal pressure — the trapped air pushes every node outward along its
 *      normal with a force proportional to the fractional area deficit; this is
 *      what keeps the bubble inflated and fights the springs.
 *   3. Aerodynamics — relative to the moving air we apply (a) stagnation
 *      pressure on windward-facing nodes (∝ v_rel² · cosθ), which dents and
 *      elongates the bubble, (b) a leeward `wake` suction (∝ v_rel² · cosθ on
 *      the back) that draws the tail out for a fore-aft-asymmetric bluff-body
 *      shape, and (c) linear drag (∝ v_rel), which advects the bubble downwind.
 *   4. Gravity — a uniform body force so a still bubble drifts down, plus a
 *      *sag* term (`sag`, ∝ the gravitational Bond number): a depth-weighted
 *      pull that stretches a large bubble vertically even in dead-still air, the
 *      same ellipse a vertical wind would produce.
 *   5. Spin — an optional rigid rotation (`spin`, rad/s) of the whole membrane
 *      about its centroid, so any elongation tumbles rather than holding still.
 *
 * @param {object} state  Bubble from createBubble (mutated in place).
 * @param {number} dt     Frame time (s).
 * @param {object} p      Parameters (see defaults below).
 * @returns {object}      The same state, for chaining.
 */
export function step(state, dt, p = {}) {
  const {
    windX = 0, // wind velocity x (px/s)
    windY = 0, // wind velocity y (px/s)
    kSpring = 260, // surface-tension stiffness
    kPressure = 90, // internal air-pressure gain
    kBend = 40, // membrane bending stiffness (resists the film folding/caving)
    stagnation = 0.9, // windward stagnation-pressure coefficient
    wake = 0, // leeward low-pressure (wake) suction — form drag / fore-aft asymmetry
    drag = 0.6, // linear (viscous) drag coefficient
    gravity = 18, // downward acceleration (px/s^2)
    sag = 0, // gravitational sag coefficient (∝ Bond number); 0 = weightless film
    spin = 0, // rigid rotation rate (rad/s) about the centroid — a tumbling bubble
    damping = 0.9, // per-second velocity retention (air resistance/relaxation)
    mass = 1,
    substeps = 4,
    // Film lifetime (only active when the bubble carries a `thickness`):
    drainage = 0, // gravity-drainage speed of the wall at 1 µm (nm/s); thicker drains faster
    evaporation = 0, // steady (still-air) evaporative thinning (nm/s); higher in dry air
    windThinning = 0, // convective-evaporation gain: airflow over the film boosts evaporation ∝ √(slip)
    critThickness = 60, // wall ruptures below this thickness (nm) — the "black film" limit
  } = p

  if (state.popped) return state

  const nodes = state.nodes
  const n = nodes.length
  const h = dt / substeps
  const dampPerSub = Math.pow(damping, h)

  for (let s = 0; s < substeps; s++) {
    const area = polygonArea(nodes)
    const sign = area >= 0 ? 1 : -1
    const areaErr = (state.restArea - Math.abs(area)) / state.restArea
    const { normals, lengths } = nodeNormals(nodes, sign)
    const cen = sag !== 0 || wake !== 0 ? centroid(nodes) : null

    // Wind unit vector and speed, for the wake tail below.
    const windMag = Math.hypot(windX, windY)
    const wux = windMag > 1e-6 ? windX / windMag : 0
    const wuy = windMag > 1e-6 ? windY / windMag : 0

    // Accumulate forces.
    const fx = new Float64Array(n)
    const fy = new Float64Array(n)
    // Gravity-sag is accumulated separately so we can strip its net (vertical)
    // force and leave a pure shape change rather than a spurious drift.
    let sagFy = 0

    for (let i = 0; i < n; i++) {
      const cur = nodes[i]
      const next = nodes[(i + 1) % n]

      // (1) Surface-tension spring on edge i -> i+1 (applied to both ends).
      const dx = next.x - cur.x
      const dy = next.y - cur.y
      const len = Math.hypot(dx, dy) || 1e-6
      const stretch = len - state.restLen
      const ux = dx / len
      const uy = dy / len
      const fs = kSpring * stretch
      fx[i] += fs * ux
      fy[i] += fs * uy
      fx[(i + 1) % n] -= fs * ux
      fy[(i + 1) % n] -= fs * uy
    }

    for (let i = 0; i < n; i++) {
      const cur = nodes[i]
      const prev = nodes[(i - 1 + n) % n]
      const next = nodes[(i + 1) % n]
      const nrm = normals[i]
      const L = lengths[i]

      // (1b) Bending: pull each node toward the midpoint of its neighbours
      // (discrete Laplacian). This resists sharp kinks, so a strong windward
      // stagnation load flattens the film instead of caving it through the
      // centre — keeping deformation monotonic in wind speed.
      fx[i] += kBend * (0.5 * (prev.x + next.x) - cur.x)
      fy[i] += kBend * (0.5 * (prev.y + next.y) - cur.y)

      // (2) Internal pressure: push outward proportional to area deficit.
      const fp = kPressure * areaErr * L
      fx[i] += fp * nrm.x
      fy[i] += fp * nrm.y

      // (2b) Gravitational sag: the hanging film is pulled down more the lower a
      // node sits (a depth-weighted vertical body force, de-meaned below so it
      // deforms rather than drifts). The bubble stretches vertically — the same
      // ellipse a vertical wind would make, which is exactly the point: from one
      // silhouette, gravity sag and wind are indistinguishable.
      if (sag !== 0) {
        const gy = sag * (cur.y - cen.y) * L // deeper node (larger y) pulled down harder
        fy[i] += gy
        sagFy += gy
      }

      // (3) Aerodynamics relative to the air.
      const vrx = windX - cur.vx
      const vry = windY - cur.vy
      const speed = Math.hypot(vrx, vry)
      if (speed > 1e-6) {
        // Stagnation pressure only on faces turned into the wind. The outward
        // normal · (-v_rel) is positive on the windward side.
        const facing = -(nrm.x * vrx + nrm.y * vry) / speed // cosθ in [-1,1]
        if (facing > 0) {
          const q = stagnation * facing * speed * speed * L * 1e-3
          // Push the windward face inward (i.e. downwind): along -normal.
          fx[i] -= q * nrm.x
          fy[i] -= q * nrm.y
        }
        // Linear drag pulls every node toward the air's velocity.
        const fd = drag * L * 1e-2
        fx[i] += fd * vrx
        fy[i] += fd * vry

        // (3b) Wake: the low-pressure region behind a bluff body draws its
        // trailing edge out into a tail. We pull the leeward tip downwind along
        // the relative wind, weighted by how far downwind the node already sits
        // (squared, so the effect concentrates at the tip and forms a tail
        // rather than just inflating the back). Scales with the wind speed, so a
        // bubble drifting with the air (no relative wind) has no wake.
        if (wake !== 0) {
          const sProj = ((cur.x - cen.x) * vrx + (cur.y - cen.y) * vry) / speed
          if (sProj > 0) {
            const w = sProj / state.R0
            const fw = wake * w * w * speed * L * 3e-2
            fx[i] += fw * vrx / speed
            fy[i] += fw * vry / speed
          }
        }
      }

      // (4) Gravity.
      fy[i] += gravity * mass
    }

    // Remove the net force contributed by gravity-sag so it produces shape,
    // not translation (weight/buoyancy drift is handled by the uniform gravity).
    if (sag !== 0) {
      const my = sagFy / n
      for (let i = 0; i < n; i++) fy[i] -= my
    }
    // The wake tail is deliberately NOT de-meaned: its asymmetry is the whole
    // point (a drawn-out leeward tail), and its small net downwind push is just
    // the extra form drag a bluff wake really adds.

    // Integrate (semi-implicit Euler) with velocity damping.
    for (let i = 0; i < n; i++) {
      const node = nodes[i]
      node.vx = (node.vx + (fx[i] / mass) * h) * dampPerSub
      node.vy = (node.vy + (fy[i] / mass) * h) * dampPerSub
      node.x += node.vx * h
      node.y += node.vy * h
    }
  }

  // Rigid spin: rotate the whole membrane (positions and velocities) about its
  // centroid. A spinning bubble carries any elongation around with it, so the
  // major-axis tilt a single frame reports is unreliable — but across a series
  // the steady advance of the angle gives the spin away. (A perfectly round
  // bubble shows no visible spin; couple it with wind/sag/launcher elongation.)
  if (spin !== 0) {
    const dth = spin * dt
    const c = Math.cos(dth)
    const s = Math.sin(dth)
    const cen = centroid(nodes)
    for (const nd of nodes) {
      const dx = nd.x - cen.x
      const dy = nd.y - cen.y
      nd.x = cen.x + dx * c - dy * s
      nd.y = cen.y + dx * s + dy * c
      const vx = nd.vx * c - nd.vy * s
      const vy = nd.vx * s + nd.vy * c
      nd.vx = vx
      nd.vy = vy
    }
    state.spinAngle = (state.spinAngle || 0) + dth
  }

  state.age += dt

  // Pop if the film is stretched past a plausible failure strain — a real
  // bubble bursts when the wind over-deforms it. Callers can watch state.popped.
  const m = measure(state)
  if (m.D > 0.62) { state.popped = true; state.popReason = 'deformed' }

  // Film lifetime: the wall thins as liquid drains (gravity, ∝ thickness²) and
  // evaporates, and it ruptures once it reaches the black-film limit. Deformation
  // speeds thinning. This is what makes a bubble's *lifetime* a real, tunable
  // quantity — the dominant driver of "how long does it last?".
  if (state.thickness != null && (drainage > 0 || evaporation > 0)) {
    const hRel = state.thickness / 1000 // relative to 1 µm
    // Convective evaporation: the film only loses water where the surrounding
    // air isn't already saturated, so wind matters by *sweeping that humid
    // boundary layer away*. The enhancement follows a boundary-layer √(airspeed)
    // law in the slip between the bubble and the air (|wind − drift|): a bubble
    // perfectly carried by a steady breeze feels no wind on its face and lives
    // its still-air life, while one that lags — or sits in a gust it never
    // catches — evaporates far faster. It multiplies evaporation (not drainage):
    // in saturated/humid air there's nothing for the wind to carry off.
    let conv = 1
    const wmag = Math.hypot(windX, windY)
    if (windThinning > 0 && evaporation > 0 && wmag > 1e-6) {
      const d = driftVelocity(state)
      // Airspeed the wind imposes across the film = the slip projected onto the
      // wind axis. The bubble's gravitational descent is (for a horizontal wind)
      // perpendicular to that axis, so it stays part of the still-air baseline
      // rather than being miscounted as wind: at zero wind, conv = 1 exactly.
      const slip = Math.abs(((windX - d.vx) * windX + (windY - d.vy) * windY) / wmag)
      conv = 1 + windThinning * Math.sqrt(slip)
    }
    const rate = (drainage * hRel * hRel + evaporation * conv) * (1 + 0.5 * m.D)
    state.thickness -= rate * dt
    if (!state.popped && state.thickness <= critThickness) {
      state.popped = true
      state.popReason = 'drained'
    }
  }

  return state
}

/**
 * How the launcher imprints the newborn bubble.
 *
 * POP's question has two halves — "how was the wind blowing *or* the wands held
 * during launch?" — and the launcher is the second half. Two kinds behave very
 * differently:
 *
 *   • Rigid wand: a fixed hoop. The opening is a fixed circle regardless of
 *     wind, so the bubble is born round (only the pinch-off pop deforms it) at a
 *     fixed size. Everything the post-launch shape then shows is *wind*.
 *
 *   • String loop: a compliant loop held by two handles. Pulling the handles
 *     apart (`sep`, 0→1) stretches the opening into an ellipse, so the bubble is
 *     born already elongated along — and tilted with — the loop. And the wind
 *     billows the loop open, so a stronger breeze births a bigger bubble (how
 *     giant bubbles are actually made). The launcher therefore stamps its own
 *     shape onto the bubble, entangled with the wind.
 *
 * The imprint is an *initial* deformation: it rings out over the relaxation time
 * while the wind's deformation persists — so telling "loop" from "wind" needs
 * the time course (video), not one frame.
 *
 * @returns {{R:number, squash:number, tilt:number}} geometry for createBubble.
 */
export function launchGeometry({ type = 'loop', R = 70, sep = 0.4, tiltRad = 0, windPx = 0 } = {}) {
  const pinch = 0.12 // every launcher pinches off a little as the film detaches
  if (type === 'wand') {
    return { R, squash: pinch, tilt: 0 }
  }
  // String loop: separation stretches the opening; wind billows it wider.
  const aspect = Math.max(0, Math.min(1, sep))
  const billow = 1 + 0.5 * Math.min(1, windPx / 200)
  return { R: R * billow, squash: pinch + 0.9 * aspect, tilt: tiltRad }
}

/**
 * Convenience: mean membrane velocity (the bubble's drift velocity), handy for
 * showing "where the bubble is going" and for the inverse-inference readout.
 */
export function driftVelocity(state) {
  let vx = 0
  let vy = 0
  for (const nd of state.nodes) {
    vx += nd.vx
    vy += nd.vy
  }
  return { vx: vx / state.nodes.length, vy: vy / state.nodes.length }
}
