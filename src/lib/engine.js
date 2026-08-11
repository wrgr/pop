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
export function createBubble({ cx = 360, cy = 200, R = 70, n = 56, vx = 0, vy = 0, squash = 0 } = {}) {
  // `squash` pre-deforms the ring into an ellipse: a real bubble pinches off the
  // wand and is born already distorted, so with light damping it rings (its
  // Rayleigh–Lamb shape mode) as it relaxes. Area is preserved (stretch one
  // axis, shrink the other by the same factor).
  const sx = 1 + squash
  const sy = 1 / sx
  const nodes = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TWO_PI
    nodes.push({
      x: cx + Math.cos(th) * R * sx,
      y: cy + Math.sin(th) * R * sy,
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
    // Diagnostics filled in by measure(); handy for the UI.
    age: 0,
    popped: false,
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
 *      pressure on windward-facing nodes (∝ v_rel² · cosθ), which is what dents
 *      and elongates the bubble, and (b) linear drag (∝ v_rel), which advects
 *      the whole bubble downwind and damps flutter.
 *   4. Gravity — a uniform body force so a still bubble drifts down, plus a
 *      *sag* term (`sag`, ∝ the gravitational Bond number): a depth-weighted
 *      pull that stretches a large bubble vertically even in dead-still air, the
 *      same ellipse a vertical wind would produce.
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
    drag = 0.6, // linear (viscous) drag coefficient
    gravity = 18, // downward acceleration (px/s^2)
    sag = 0, // gravitational sag coefficient (∝ Bond number); 0 = weightless film
    damping = 0.9, // per-second velocity retention (air resistance/relaxation)
    mass = 1,
    substeps = 4,
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
    const cen = sag !== 0 ? centroid(nodes) : null

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

    // Integrate (semi-implicit Euler) with velocity damping.
    for (let i = 0; i < n; i++) {
      const node = nodes[i]
      node.vx = (node.vx + (fx[i] / mass) * h) * dampPerSub
      node.vy = (node.vy + (fy[i] / mass) * h) * dampPerSub
      node.x += node.vx * h
      node.y += node.vy * h
    }
  }

  state.age += dt

  // Pop if the film is stretched past a plausible failure strain — a real
  // bubble bursts when the wind over-deforms it. Callers can watch state.popped.
  const m = measure(state)
  if (m.D > 0.62) state.popped = true

  return state
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
