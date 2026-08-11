import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { createBubble, step, measure, driftVelocity } from '../lib/engine.js'
import { weberFromDeformation } from '../lib/inference.js'

// Calibration of *this* engine: the empirical Weber number recovered from the
// measured shape relates to the relative wind (in px/s) as We ≈ K_CAL · U_rel².
// Fitted by sweeping the engine at held relative winds (see test/engine.test.js).
// It lets us invert a measured shape back into a relative wind speed.
const K_CAL = 1.3e-4

/**
 * Live soft-body bubble physics playground.
 *
 * Unlike the algebraic Simulator (which draws the ellipse a formula predicts),
 * this component runs POP's real `engine.js`: a membrane of point masses that
 * actually deforms and drifts under a simulated wind. Every frame we *measure*
 * the emergent shape and run POP's inverse model on it — so you can watch the
 * core question answer itself in real time: the shape the physics produces is
 * fed back through `weberFromDeformation` to recover the wind that made it.
 */

const W = 720
const H = 380

// A field of little tracer dots so the wind is visible, not just felt.
function makeTracers(count) {
  // Deterministic pseudo-random layout (no Math.random dependency at import).
  const tracers = []
  let seed = 1337
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < count; i++) {
    tracers.push({ x: rnd() * W, y: rnd() * H, life: rnd() })
  }
  return tracers
}

const BubblePhysics = memo(function BubblePhysics() {
  const [params, setParams] = useState({
    windSpeed: 3.2, // m/s (display) — scaled to px/s for the engine
    windDir: 0, // degrees, 0 = blowing right
    gust: 0.25, // gust amplitude (fraction of windSpeed)
    launch: 2.0, // launch speed off the wand (m/s)
    R: 70, // bubble radius (px)
    kSpring: 260, // surface tension
    kPressure: 90, // internal pressure
  })
  const [running, setRunning] = useState(true)
  const [showField, setShowField] = useState(true)
  const [readout, setReadout] = useState(null)

  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const tracersRef = useRef(makeTracers(90))
  const rafRef = useRef(null)
  const lastRef = useRef(0)
  const tRef = useRef(0)
  const paramsRef = useRef(params)
  const runningRef = useRef(running)
  const fieldRef = useRef(showField)
  const readoutAccum = useRef(0)

  useEffect(() => { paramsRef.current = params }, [params])
  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { fieldRef.current = showField }, [showField])

  // Pixels-per-(m/s): keeps the on-screen motion lively while the readout still
  // reports the physical wind speed the user dialled in.
  const PX_PER_MS = 26

  const launchBubble = useCallback(() => {
    const p = paramsRef.current
    const ang = (p.windDir * Math.PI) / 180
    // Launch mostly along the wind, with a little upward pop off the wand.
    const v = p.launch * PX_PER_MS
    stateRef.current = createBubble({
      cx: 190,
      cy: H / 2,
      R: p.R,
      n: 56,
      vx: Math.cos(ang) * v,
      vy: -Math.abs(Math.sin(ang) * v) - 60, // slight upward kick
    })
    tRef.current = 0
  }, [])

  // Seed a bubble on mount.
  useEffect(() => { launchBubble() }, [launchBubble])

  const currentWind = useCallback((t) => {
    const p = paramsRef.current
    const gust = 1 + p.gust * Math.sin(t * 1.7) * Math.sin(t * 0.6 + 1)
    const speedPx = p.windSpeed * PX_PER_MS * gust
    const ang = (p.windDir * Math.PI) / 180
    return { wx: Math.cos(ang) * speedPx, wy: Math.sin(ang) * speedPx, speedPx }
  }, [])

  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const state = stateRef.current
    const p = paramsRef.current
    const t = tRef.current
    const { wx, wy } = currentWind(t)

    // Sky backdrop.
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#eafaff')
    grad.addColorStop(1, '#fff0f8')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Wind tracers advected by the current field.
    if (fieldRef.current) {
      const tracers = tracersRef.current
      ctx.strokeStyle = 'rgba(112,214,255,0.55)'
      ctx.lineWidth = 1.5
      for (const tr of tracers) {
        const nx = tr.x + wx * 0.016
        const ny = tr.y + wy * 0.016
        ctx.beginPath()
        ctx.moveTo(tr.x, tr.y)
        ctx.lineTo(nx, ny)
        ctx.stroke()
        tr.x = nx
        tr.y = ny
        tr.life -= 0.008
        if (tr.x < 0 || tr.x > W || tr.y < 0 || tr.y > H || tr.life <= 0) {
          // Respawn upstream so the stream keeps flowing.
          tr.x = wx >= 0 ? -4 : W + 4
          tr.y = Math.random() * H
          tr.life = 0.6 + Math.random() * 0.6
        }
      }
    }

    // The wand the bubble launched from.
    ctx.strokeStyle = '#ff7abc'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(150, H - 20)
    ctx.lineTo(180, H / 2 + 30)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,122,188,0.7)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(190, H / 2, 26, 34, -0.2, 0, Math.PI * 2)
    ctx.stroke()

    if (!state) return
    const nodes = state.nodes
    const m = measure(state)

    // Filled iridescent membrane.
    ctx.beginPath()
    ctx.moveTo(nodes[0].x, nodes[0].y)
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y)
    ctx.closePath()

    const fill = ctx.createRadialGradient(
      m.centroid.x - m.a * 0.3, m.centroid.y - m.b * 0.3, 4,
      m.centroid.x, m.centroid.y, Math.max(m.a, m.b)
    )
    fill.addColorStop(0, 'rgba(255,255,255,0.65)')
    fill.addColorStop(0.45, 'rgba(112,214,255,0.28)')
    fill.addColorStop(0.75, 'rgba(255,122,188,0.24)')
    fill.addColorStop(1, 'rgba(160,120,255,0.22)')
    ctx.fillStyle = fill
    ctx.fill()

    ctx.strokeStyle = state.popped ? 'rgba(255,107,107,0.9)' : 'rgba(58,209,201,0.95)'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Specular highlight.
    ctx.beginPath()
    ctx.ellipse(m.centroid.x - m.a * 0.35, m.centroid.y - m.b * 0.35, m.a * 0.14, m.b * 0.1, m.angle, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fill()

    // Fitted principal axis (the "measured shape").
    ctx.save()
    ctx.translate(m.centroid.x, m.centroid.y)
    ctx.rotate(m.angle)
    ctx.strokeStyle = 'rgba(18,34,51,0.35)'
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(0, 0, m.a, m.b, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    if (state.popped) {
      ctx.fillStyle = 'rgba(255,107,107,0.95)'
      ctx.font = '600 18px Poppins, system-ui, sans-serif'
      ctx.fillText('pop! — over-deformed by the wind', m.centroid.x - 90, m.centroid.y - m.b - 14)
    }
  }, [currentWind])

  // Main loop: physics + inference + draw, decoupled from React state.
  useEffect(() => {
    const loop = (now) => {
      const last = lastRef.current || now
      let dt = (now - last) / 1000
      lastRef.current = now
      if (dt > 0.05) dt = 0.05 // clamp big tab-switch gaps

      const state = stateRef.current
      const p = paramsRef.current
      if (state && runningRef.current) {
        tRef.current += dt
        const { wx, wy } = currentWind(tRef.current)
        step(state, dt, {
          windX: wx,
          windY: wy,
          kSpring: p.kSpring,
          kPressure: p.kPressure,
        })

        // Recycle the bubble once it drifts off-screen or bursts.
        const c = state.nodes.length ? measure(state).centroid : { x: 0, y: 0 }
        if (state.popped || c.x > W + 80 || c.x < -80 || c.y > H + 80 || c.y < -120) {
          // brief pause on a pop so the label is visible
          if (state.popped) {
            state._popTimer = (state._popTimer || 0) + dt
            if (state._popTimer > 0.7) launchBubble()
          } else {
            launchBubble()
          }
        }

        // Throttle the React readout to ~10 Hz — the inverse-inference result.
        readoutAccum.current += dt
        if (readoutAccum.current > 0.1) {
          readoutAccum.current = 0
          const m = measure(state)
          const drift = driftVelocity(state)
          const We = weberFromDeformation(m.D)

          // The shape encodes the wind *relative to the drifting bubble*.
          // Actual relative wind the engine is applying, in m/s:
          const relPx = Math.hypot(wx - drift.vx, wy - drift.vy)
          const relTrue = relPx / PX_PER_MS
          // Relative wind recovered purely from the measured shape:
          const relInfer = We != null ? Math.sqrt(We / K_CAL) / PX_PER_MS : null

          setReadout({
            D: m.D,
            chi: m.chi,
            area: m.area,
            restArea: state.restArea,
            We,
            windSet: p.windSpeed,
            relTrue,
            relInfer,
            driftMs: Math.hypot(drift.vx, drift.vy) / PX_PER_MS,
            popped: state.popped,
          })
        }
      }

      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentWind, draw, launchBubble])

  const set = useCallback((k, v) => setParams((prev) => ({ ...prev, [k]: v })), [])

  const areaPct = readout ? (readout.area / readout.restArea) * 100 : 100

  return (
    <div className="stack">
      <div className="notice" style={{ margin: 0 }}>
        A real soft-body simulation: the membrane is <strong>point masses + surface-tension
        springs + internal air pressure</strong>, deformed by an aerodynamic wind model. Nothing
        here is a pre-baked ellipse — POP then <strong>measures the emergent shape and infers the
        wind back</strong> from it, live.
      </div>

      <div className="sim-wrap">
        <canvas ref={canvasRef} width={W} height={H}></canvas>
      </div>

      <div className="controls" style={{ gap: 14 }}>
        <button className="btn primary" onClick={launchBubble}>🫧 Launch bubble</button>
        <button className="btn" onClick={() => setRunning((r) => !r)}>
          {running ? '⏸ Pause' : '▶ Play'}
        </button>
        <label className="pill" title="Show wind tracers">
          <input type="checkbox" checked={showField} onChange={(e) => setShowField(e.target.checked)} />
          🌬️ wind field
        </label>
      </div>

      <div className="controls" style={{ gap: 16 }}>
        <label className="pill" title="Wind speed (m/s)">
          🌬️ Wind
          <input type="range" min="0" max="9" step="0.1" value={params.windSpeed}
            onChange={(e) => set('windSpeed', parseFloat(e.target.value))} /> {params.windSpeed.toFixed(1)} m/s
        </label>
        <label className="pill" title="Wind direction (deg)">
          🧭 Dir
          <input type="range" min="-60" max="60" step="1" value={params.windDir}
            onChange={(e) => set('windDir', parseFloat(e.target.value))} /> {params.windDir}°
        </label>
        <label className="pill" title="Gustiness">
          💨 Gust
          <input type="range" min="0" max="0.8" step="0.02" value={params.gust}
            onChange={(e) => set('gust', parseFloat(e.target.value))} /> {(params.gust * 100).toFixed(0)}%
        </label>
        <label className="pill" title="Launch speed off the wand (m/s)">
          🪄 Launch
          <input type="range" min="0" max="5" step="0.1" value={params.launch}
            onChange={(e) => set('launch', parseFloat(e.target.value))} /> {params.launch.toFixed(1)} m/s
        </label>
      </div>

      <div className="controls" style={{ gap: 16 }}>
        <label className="pill" title="Bubble radius (px)">
          ⚪ Size
          <input type="range" min="35" max="105" step="1" value={params.R}
            onChange={(e) => set('R', parseFloat(e.target.value))} /> {params.R}px
        </label>
        <label className="pill" title="Surface tension (spring stiffness)">
          🔗 Tension
          <input type="range" min="120" max="420" step="10" value={params.kSpring}
            onChange={(e) => set('kSpring', parseFloat(e.target.value))} /> {params.kSpring}
        </label>
        <label className="pill" title="Internal air pressure">
          🎈 Pressure
          <input type="range" min="40" max="180" step="5" value={params.kPressure}
            onChange={(e) => set('kPressure', parseFloat(e.target.value))} /> {params.kPressure}
        </label>
      </div>

      {readout && (
        <div className="kv">
          <div className="label">Measured deformation D</div>
          <div>
            {readout.D.toFixed(3)}{' '}
            <span className="small" style={{ color: readout.D > 0.45 ? 'var(--warn)' : 'var(--good)' }}>
              (χ = {readout.chi.toFixed(2)})
            </span>
          </div>
          <div className="label">Inferred Weber number</div>
          <div>
            {readout.We != null ? readout.We.toFixed(2) : '— (past the empirical law’s valid range)'}
          </div>
          <div className="label">Relative wind: applied vs. read-from-shape</div>
          <div>
            <strong>{readout.relTrue.toFixed(1)} m/s</strong> applied →{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {readout.relInfer != null ? readout.relInfer.toFixed(1) : '—'} m/s
            </strong>{' '}
            recovered from the shape
          </div>
          <div className="label">Bubble drift (why "set" ≠ "relative")</div>
          <div>
            {readout.driftMs.toFixed(1)} m/s downwind — you set {readout.windSet.toFixed(1)} m/s, but
            the film only feels the wind <em>relative</em> to its own motion
          </div>
          <div className="label">Air-mass conservation</div>
          <div>{areaPct.toFixed(1)}% of rest area (pressure ↔ tension balance)</div>
        </div>
      )}

      <div className="footer small" style={{ padding: 0, border: 'none' }}>
        The <strong>applied → recovered</strong> row is POP's thesis in miniature: the wind that
        shaped the bubble is read straight back out of the shape the physics produced (they track
        with a lag set by the relaxation time τ). And because a drifting bubble only feels the{' '}
        <em>relative</em> wind, one snapshot can't separate wind from the bubble's own motion — which
        is exactly why POP's analyzer turns to <strong>video</strong>. Crank the wind up and watch
        the film over-deform and pop.
      </div>
    </div>
  )
})

export default BubblePhysics
