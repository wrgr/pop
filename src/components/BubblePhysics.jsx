import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { createBubble, step, measure, driftVelocity, launchGeometry } from '../lib/engine.js'
import { weberFromDeformation } from '../lib/inference.js'
import { analyzeSeries } from '../lib/forensics.js'
import { coachBubble, ringSignature, bubbleLifetime, GOALS, MODEL_GAPS } from '../lib/diagnostics.js'
import { computeMouthStats, calculateLoopArea } from '../lib/physics.js'
import WandEditor from './WandEditor.jsx'
import Drawer from './Drawer.jsx'
import Bubble3D from './Bubble3D.jsx'

// Derive a bubble's birth geometry from a hand-drawn wand loop: its area sets
// the size, its aspect sets the elongation, its tilt sets the orientation — so
// the shape you draw is the shape the bubble is born with.
function customGeometry(points) {
  const area = calculateLoopArea(points)
  const stats = computeMouthStats(points)
  if (!area || (!stats.width && !stats.height)) return null
  const loopR = Math.sqrt(area / Math.PI) // px in the editor's frame
  const R = Math.max(35, Math.min(110, loopR))
  const big = Math.max(stats.width, stats.height)
  const small = Math.max(1, Math.min(stats.width, stats.height))
  const squash = Math.max(0, Math.min(0.8, big / small - 1))
  return { R, squash, tilt: stats.angle }
}

// Calibration of *this* engine: the empirical Weber number recovered from the
// measured shape relates to the relative wind (in px/s) as We ≈ K_CAL · U_rel².
// Fitted by sweeping the engine at held relative winds (see test/engine.test.js).
// It lets us invert a measured shape back into a relative wind speed.
const K_CAL = 1.3e-4

/**
 * Live soft-body bubble physics playground.
 *
 * Rather than drawing the ellipse a closed-form formula predicts, this component
 * runs POP's real `engine.js`: a membrane of point masses that
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

// One-click scenarios — a curated scene per goal (harder/better/faster/stronger).
// Each patch sets the sliders (including the advanced ones a Simple-mode user
// never sees), so pressing one drops you straight into an interesting bubble.
const PRESETS = [
  {
    key: 'giant', icon: '🫧', label: 'Giant-bubble sweet spot', goal: 'bigger',
    note: 'A gentle, steady breeze billows the string loop open — big and beautiful. Nudge Wind up and watch it burst: that narrow "just enough breeze" is the real giant-bubble trick.',
    patch: { launcher: 'loop', handleSep: 0.5, R: 96, windSpeed: 1.0, windDir: 0, gust: 0.05, launch: 1.5, film: 1.4, mix: 0.6, humidity: 0.6, bond: 0.9, wake: 0, spin: 0 },
  },
  {
    key: 'longflight', icon: '⏳', label: 'Long flight', goal: 'longer',
    note: 'Thick, conditioned film in humid, calm air — the longest-lived bubble POP can make. Hit Record & analyze to time how long it lasts.',
    patch: { launcher: 'loop', handleSep: 0.35, R: 70, windSpeed: 0.5, windDir: 0, gust: 0.05, launch: 1.5, film: 2.4, mix: 1.0, humidity: 0.9, bond: 0.6, wake: 0, spin: 0 },
  },
  {
    key: 'confound', icon: '🔎', label: 'The confound', goal: 'harder',
    note: 'Still air, a big heavy bubble sagging under gravity — one frame looks exactly like a vertical wind. Press Record & analyze: the time-course tells them apart.',
    patch: { launcher: 'wand', R: 96, windSpeed: 0, windDir: 0, gust: 0, launch: 1.0, film: 1.2, mix: 0.4, humidity: 0.5, bond: 2.2, wake: 0, spin: 0 },
  },
  {
    key: 'race', icon: '💨', label: 'Downwind race', goal: 'faster',
    note: 'A small, light bubble launched straight downwind in a strong, steady breeze — maximum speed, minimum sturdiness. The opposite of "The confound".',
    patch: { launcher: 'wand', R: 46, windSpeed: 6.5, windDir: 0, gust: 0.12, launch: 3.0, film: 0.5, mix: 0.3, humidity: 0.4, bond: 0.4, wake: 1.8, spin: 0 },
  },
]

const BubblePhysics = memo(function BubblePhysics() {
  const [params, setParams] = useState({
    windSpeed: 3.2, // m/s (display) — scaled to px/s for the engine
    windDir: 0, // degrees, 0 = blowing right
    gust: 0.25, // gust amplitude (fraction of windSpeed)
    launch: 2.0, // launch speed off the wand (m/s)
    R: 70, // bubble radius (px)
    kSpring: 260, // surface tension
    kPressure: 90, // internal pressure
    bond: 0.8, // gravitational Bond number (gravity sag / teardrop)
    film: 1.0, // soap-film thickness (µm) — sets membrane inertia / ring rate
    launcher: 'loop', // 'loop' string loop | 'wand' rigid hoop | 'custom' drawn loop
    handleSep: 0.45, // string-loop handle separation (0 = round loop, 1 = long thin)
    wake: 0, // leeward wake suction — fore-aft asymmetry (bluff-body tail)
    spin: 0, // rigid rotation rate (rad/s) — a tumbling bubble
    humidity: 0.5, // 0 = dry (fast evaporation) … 1 = humid (slow) — sets film lifetime
    mix: 0.4, // 0 = watery … 1 = conditioned/glycerin — surfactant elasticity (sturdier + longer)
  })
  const [running, setRunning] = useState(true)
  const [showField, setShowField] = useState(true)
  const [readout, setReadout] = useState(null)
  const [report, setReport] = useState(null)
  const [goal, setGoal] = useState('harder') // coach objective: bigger|longer|faster|harder
  const [mode, setMode] = useState('simple') // 'simple' = clean starting point | 'expert' = every knob
  const [presetNote, setPresetNote] = useState(null) // "what to notice" for the last scenario applied
  const [view, setView] = useState('2d') // '2d' canvas | '3d' three.js
  const [wand, setWand] = useState([]) // custom wand/loop control points (WandEditor)
  const wandRef = useRef(wand)
  useEffect(() => { wandRef.current = wand }, [wand])
  // Latest measured shape, published every physics frame for the 3D view to read.
  const latestRef = useRef(null)
  const getFrame = useCallback(() => latestRef.current, [])

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

  // Bond number -> engine sag coefficient. The depth-weighted sag force scales
  // with the bubble's size, so we compensate by (70/R) to keep the on-screen
  // elongation set by Bo (not size), and cap it so it stays well short of pop.
  const sagFromBond = (bond, R) => Math.min(0.04, bond * 0.011 * (70 / R))
  // Film thickness (µm) -> node mass. Thicker film = heavier = slower ring.
  const massFromFilm = (film) => 0.5 + film * 0.6
  // Film thickness (µm) -> initial wall thickness (nm) for the lifetime model.
  const thicknessFromFilm = (film) => film * 1000
  // Humidity (0 dry … 1 humid) -> evaporative thinning (nm/s); drier evaporates faster.
  const evaporationFromHumidity = (h) => 34 - 26 * h
  const DRAINAGE = 220 // gravity-drainage speed of the wall at 1 µm (nm/s)
  const WIND_THINNING = 0.14 // convective-evaporation gain: airflow across the film speeds evaporation ∝ √(slip)
  const LIVE_GRAVITY = 10 // downward acceleration used everywhere the bubble flies (px/s²)
  // Buoyancy of the displaced air: set so the thinnest film is ~neutral (hangs)
  // and heavier films sink — that's what makes "floaty vs. heavy" readable.
  const BUOYANCY = LIVE_GRAVITY * massFromFilm(0.5) // neutral at the lightest film

  // Resolve the newborn bubble's {R, squash, tilt} from the chosen launcher.
  // 'custom' reads the hand-drawn loop; the others use the analytic model.
  const geometryFor = useCallback((p) => {
    if (p.launcher === 'custom') {
      const g = customGeometry(wandRef.current)
      if (g) return g
    }
    return launchGeometry({
      type: p.launcher,
      R: p.R,
      sep: p.handleSep,
      tiltRad: 0, // handles held horizontally -> horizontal loop imprint
      windPx: p.windSpeed * PX_PER_MS,
    })
  }, [])

  const launchBubble = useCallback(() => {
    const p = paramsRef.current
    const ang = (p.windDir * Math.PI) / 180
    // Launch mostly along the wind, with a little upward pop off the launcher.
    const v = p.launch * PX_PER_MS
    // The launcher sets the bubble's birth size, elongation and tilt.
    const g = geometryFor(p)
    stateRef.current = createBubble({
      cx: 190,
      cy: H / 2,
      R: g.R,
      n: 56,
      vx: Math.cos(ang) * v,
      vy: -Math.abs(Math.sin(ang) * v) - 60, // slight upward kick
      squash: g.squash,
      tilt: g.tilt,
      thickness: thicknessFromFilm(p.film), // starts draining immediately
    })
    tRef.current = 0
  }, [geometryFor])

  // Go the other way: fly a fresh bubble with the current settings, record the
  // shape series a camera would capture, then infer the environment back from
  // it — and lay the recovered values next to the truth we set.
  const recordAndAnalyze = useCallback(() => {
    const p = paramsRef.current
    const ang = (p.windDir * Math.PI) / 180
    const wx = Math.cos(ang) * p.windSpeed * PX_PER_MS
    const wy = Math.sin(ang) * p.windSpeed * PX_PER_MS
    const g = geometryFor(p)
    const v = p.launch * PX_PER_MS
    const b = createBubble({
      cx: 190, cy: H / 2, R: g.R, n: 56,
      vx: Math.cos(ang) * v, vy: -Math.abs(Math.sin(ang) * v) - 60,
      squash: g.squash, tilt: g.tilt,
    })
    const frames = []
    const dt = 1 / 60
    for (let t = 0; t < 2.4; t += dt) {
      step(b, dt, {
        windX: wx, windY: wy,
        kSpring: p.kSpring, kPressure: p.kPressure,
        gravity: LIVE_GRAVITY, buoyancy: BUOYANCY, sag: sagFromBond(p.bond, p.R), mass: massFromFilm(p.film),
        elasticity: p.mix, wake: p.wake, spin: p.spin,
      })
      const m = measure(b)
      frames.push({ t, D: m.D, chi: m.chi, angle: m.angle, area: m.area, cx: m.centroid.x, cy: m.centroid.y })
      if (b.popped) break
    }
    const rep = analyzeSeries(frames, { pxPerMs: PX_PER_MS, kCal: K_CAL })

    // Characterise the recorded bubble for the coach: an approximate display
    // diameter (px→cm), the wind it flew in, its launcher, and a measured film
    // ring signature.
    const cfg = { R: p.R, kSpring: p.kSpring, kPressure: p.kPressure, mass: massFromFilm(p.film), elasticity: p.mix }
    const ring = ringSignature(cfg)
    // Time the film draining — both the still-air baseline and the life it
    // actually gets in the wind it flew in (convective evaporation shortens it).
    const lifeOpts = { thickness: thicknessFromFilm(p.film), drainage: DRAINAGE, evaporation: evaporationFromHumidity(p.humidity), elasticity: p.mix }
    const lifetimeS = bubbleLifetime(cfg, lifeOpts)
    const lifetimeWindS = bubbleLifetime(cfg, { ...lifeOpts, windMs: p.windSpeed, windThinning: WIND_THINNING })
    const obs = {
      diameterCm: p.R * 0.28, // nominal px→cm for display
      windMs: p.windSpeed,
      sigma: 0.03,
      launcher: p.launcher,
      filmUm: p.film,
      spinRate: rep.spinning ? rep.spinRate : p.spin,
      ring,
      lifetimeS,
      lifetimeWindS,
      mix: p.mix,
    }

    setReport({
      ...rep,
      nFrames: frames.length,
      obs,
      truth: {
        windSpeed: p.windSpeed, windDir: p.windDir, launcher: p.launcher,
        film: p.film, spin: p.spin, bond: p.bond,
      },
    })
  }, [geometryFor])

  // Seed a bubble on mount.
  useEffect(() => { launchBubble() }, [launchBubble])

  // Re-launch when the launcher type changes so the contrast is immediate.
  // (paramsRef is synced above, so launchBubble reads the new launcher.)
  useEffect(() => { launchBubble() }, [params.launcher, launchBubble])

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

    // The launcher the bubble came off — a rigid wand or a compliant string loop.
    const Lx = 190
    const Ly = H / 2
    if (p.launcher === 'wand') {
      // Rigid hoop on a stick: fixed circle, no sway, no billow.
      ctx.strokeStyle = '#ff7abc'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(150, H - 18)
      ctx.lineTo(Lx - 14, Ly + 26)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,122,188,0.9)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(Lx, Ly, 26, 28, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.launcher === 'custom') {
      // Custom loop drawn in the editor below: preview its birth shape here.
      const g = customGeometry(wandRef.current)
      ctx.strokeStyle = 'rgba(160,120,255,0.95)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(150, H - 16)
      ctx.lineTo(Lx - 14, Ly + 26)
      ctx.stroke()
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      if (g) {
        const sx = 1 + g.squash
        ctx.ellipse(Lx, Ly, 27 * sx, 29 / sx, g.tilt, 0, Math.PI * 2)
      } else {
        ctx.ellipse(Lx, Ly, 27, 29, 0, 0, Math.PI * 2)
      }
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      // String loop between two handles: sways, and the wind billows it open.
      const windSign = wx >= 0 ? 1 : -1
      const sway = Math.sin(t * 2.2) * 3 * (1 + p.windSpeed * 0.08)
      const rx = 20 + 34 * p.handleSep // wider as the handles are pulled apart
      const ry = 42 - 16 * p.handleSep
      ctx.strokeStyle = 'rgba(91,107,255,0.85)'
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let k = 0; k <= 44; k++) {
        const th = (k / 44) * Math.PI * 2
        const facing = Math.cos(th) * windSign // +1 on the downwind side
        const px = Lx + Math.cos(th) * rx + windSign * Math.max(0, facing) * (6 + p.windSpeed * 2.2)
        const py = Ly + Math.sin(th) * ry + sway * Math.sin(th)
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      // Two handle dowels reaching up to the loop's sides.
      ctx.strokeStyle = '#b5794a'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(146, H - 14)
      ctx.lineTo(Lx - rx, Ly + sway)
      ctx.moveTo(170, H - 14)
      ctx.lineTo(Lx - rx * 0.15, Ly + ry * 0.92 + sway)
      ctx.stroke()
    }

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
      const label = state.popReason === 'drained' ? 'pop! — the wall drained out' : 'pop! — over-deformed by the wind'
      ctx.fillText(label, m.centroid.x - 100, m.centroid.y - m.b - 14)
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
          gravity: LIVE_GRAVITY, // soap bubbles are nearly neutrally buoyant — they float down slowly
          buoyancy: BUOYANCY, // net of displaced air: heavy films sink, thin ones hang
          sag: sagFromBond(p.bond, p.R),
          mass: massFromFilm(p.film),
          elasticity: p.mix, // conditioned mix = sturdier + longer-lived
          wake: p.wake,
          spin: p.spin,
          drainage: DRAINAGE,
          evaporation: evaporationFromHumidity(p.humidity),
          windThinning: WIND_THINNING,
        })

        // Publish the current shape for the 3D view (and reuse for recycling).
        const mNow = measure(state)
        latestRef.current = { a: mNow.a, b: mNow.b, angle: mNow.angle, R0: state.R0, popped: state.popped }

        // Recycle the bubble once it drifts off-screen or bursts.
        const c = mNow.centroid
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
            vy: drift.vy, // vertical drift (px/s): + sinks, − rises
            bond: p.bond,
            film: p.film,
            launcher: p.launcher,
            age: state.age,
            thickness: state.thickness,
            thickness0: thicknessFromFilm(p.film),
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

  // Apply a one-click scenario: patch the params, sync the imperative ref so the
  // very next launch uses the new scene, pick the matching goal, and fly it.
  const applyPreset = useCallback((p) => {
    setParams((prev) => {
      const next = { ...prev, ...p.patch }
      paramsRef.current = next
      return next
    })
    if (p.goal) setGoal(p.goal)
    setRunning(true)
    runningRef.current = true
    setPresetNote(p.note)
    launchBubble()
  }, [launchBubble])

  const areaPct = readout ? (readout.area / readout.restArea) * 100 : 100
  const plan = report && report.obs ? coachBubble(report.obs, goal) : null

  return (
    <div className="stack">
      <div className="controls" style={{ gap: 10, justifyContent: 'space-between' }}>
        <div className="small" style={{ color: 'var(--ink2)' }}>
          {mode === 'simple'
            ? 'Press a scenario below, or just hit Launch and play with the wind.'
            : 'A real soft-body sim — point masses + surface-tension springs + air pressure — that measures the emergent shape and infers the wind back, live.'}
        </div>
        <div className="pill" style={{ gap: 6 }} title="Simple = a clean starting point. Expert = every knob and readout.">
          <button className={`btn small ${mode === 'simple' ? 'primary' : 'ghost'}`} onClick={() => setMode('simple')}>Simple</button>
          <button className={`btn small ${mode === 'expert' ? 'primary' : 'ghost'}`} onClick={() => setMode('expert')}>Expert</button>
        </div>
      </div>

      <div className="sim-wrap">
        {view === '3d'
          ? <Bubble3D getFrame={getFrame} width={W} height={H} />
          : <canvas ref={canvasRef} width={W} height={H}></canvas>}
      </div>

      <div className="controls" style={{ gap: 8 }}>
        <span className="small" style={{ alignSelf: 'center', color: 'var(--ink2)', fontWeight: 600 }}>✨ Scenarios</span>
        {PRESETS.map((p) => (
          <button key={p.key} className="btn small" title={p.note} onClick={() => applyPreset(p)}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      {presetNote && (
        <div className="notice" style={{ margin: 0 }}>{presetNote}</div>
      )}

      <div className="controls" style={{ gap: 14 }}>
        <button className="btn primary" onClick={launchBubble}>🫧 Launch bubble</button>
        <button className="btn" onClick={() => setRunning((r) => !r)}>
          {running ? '⏸ Pause' : '▶ Play'}
        </button>
        {mode === 'expert' && (
          <div className="pill" style={{ gap: 6 }} title="Render the same physics in 2D or 3D">
            <button className={`btn small ${view === '2d' ? 'primary' : 'ghost'}`} onClick={() => setView('2d')}>2D</button>
            <button className={`btn small ${view === '3d' ? 'primary' : 'ghost'}`} onClick={() => setView('3d')}>🧊 3D</button>
          </div>
        )}
        {mode === 'expert' && view === '2d' && (
          <label className="pill" title="Show wind tracers">
            <input type="checkbox" checked={showField} onChange={(e) => setShowField(e.target.checked)} />
            🌬️ wind field
          </label>
        )}
        <button className="btn" onClick={recordAndAnalyze} title="Fly a bubble, then infer the settings back from its shape series">
          🎥 Record &amp; analyze
        </button>
      </div>

      <div className="controls" style={{ gap: 12 }}>
        <div className="pill" style={{ gap: 8 }} title="What the bubble is launched from">
          🧰 Launcher
          <button
            className={`btn small ${params.launcher === 'loop' ? 'primary' : 'ghost'}`}
            onClick={() => set('launcher', 'loop')}
          >
            🪢 String loop
          </button>
          <button
            className={`btn small ${params.launcher === 'wand' ? 'primary' : 'ghost'}`}
            onClick={() => set('launcher', 'wand')}
          >
            ⭕ Rigid wand
          </button>
          <button
            className={`btn small ${params.launcher === 'custom' ? 'primary' : 'ghost'}`}
            onClick={() => set('launcher', 'custom')}
          >
            ✏️ Custom loop
          </button>
        </div>
        {params.launcher === 'loop' && (
          <label className="pill" title="Handle separation — pulls the loop into a long thin opening">
            ↔️ Handles
            <input type="range" min="0" max="1" step="0.05" value={params.handleSep}
              onChange={(e) => set('handleSep', parseFloat(e.target.value))} /> {(params.handleSep * 100).toFixed(0)}%
          </label>
        )}
        <span className="small" style={{ alignSelf: 'center', color: 'var(--ink2)' }}>
          {params.launcher === 'loop'
            ? 'A compliant loop stamps its own elongation on the bubble and the wind billows it open.'
            : params.launcher === 'wand'
              ? 'A rigid hoop hands off a clean round bubble — post-launch shape is pure wind.'
              : 'Shape the loop below — its area sets the bubble’s size, its aspect and tilt its birth shape.'}
        </span>
      </div>

      {params.launcher === 'custom' && (
        <div className="card" style={{ margin: 0 }}>
          <h4 style={{ marginTop: 0 }}>✏️ Design your wand</h4>
          <p className="small" style={{ marginTop: 0 }}>
            Drag the handles and blue string points to shape the loop, then <strong>Launch</strong> or{' '}
            <strong>Record &amp; analyze</strong> — the bubble is born in the loop’s size, aspect and tilt.
          </p>
          <WandEditor points={wand} onChange={setWand} />
        </div>
      )}

      <div className="controls" style={{ gap: 16 }}>
        <label className="pill" title="Wind speed (m/s)">
          🌬️ Wind
          <input type="range" min="0" max="9" step="0.1" value={params.windSpeed}
            onChange={(e) => set('windSpeed', parseFloat(e.target.value))} /> {params.windSpeed.toFixed(1)} m/s
        </label>
        {mode === 'expert' && (
          <>
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
          </>
        )}
      </div>

      {mode === 'expert' && (
      <Drawer title="⚙️ More parameters (size, gravity, film, humidity, mix, wake, spin)">
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

      <div className="controls" style={{ gap: 16 }}>
        <label className="pill" title="Gravitational Bond number — gravity sag vs. surface tension">
          ⬇️ Gravity (Bo)
          <input type="range" min="0" max="2.5" step="0.05" value={params.bond}
            onChange={(e) => set('bond', parseFloat(e.target.value))} /> {params.bond.toFixed(2)}
        </label>
        <label className="pill" title="Soap-film thickness — sets ring rate and how long the wall lasts">
          🎞️ Film
          <input type="range" min="0.3" max="3" step="0.1" value={params.film}
            onChange={(e) => set('film', parseFloat(e.target.value))} /> {params.film.toFixed(1)} µm
        </label>
        <label className="pill" title="Air humidity — dry air evaporates the wall faster (shorter life)">
          💧 Humidity
          <input type="range" min="0" max="1" step="0.05" value={params.humidity}
            onChange={(e) => set('humidity', parseFloat(e.target.value))} /> {(params.humidity * 100).toFixed(0)}%
        </label>
        <label className="pill" title="Soap mix — a conditioned (glycerin) mix heals thin spots: sturdier and longer-lived">
          🧼 Mix
          <input type="range" min="0" max="1" step="0.05" value={params.mix}
            onChange={(e) => set('mix', parseFloat(e.target.value))} /> {params.mix < 0.33 ? 'watery' : params.mix < 0.66 ? 'soapy' : 'conditioned'}
        </label>
        <span className="small" style={{ alignSelf: 'center', color: 'var(--ink2)' }}>
          A thicker film in humid air lasts far longer; a conditioned mix survives more and lasts longer still. Thin films hang in the air, heavy ones sink.
        </span>
      </div>

      <div className="controls" style={{ gap: 16 }}>
        <label className="pill" title="Leeward wake suction — draws a fore-aft tail">
          🌀 Wake
          <input type="range" min="0" max="5" step="0.1" value={params.wake}
            onChange={(e) => set('wake', parseFloat(e.target.value))} /> {params.wake.toFixed(1)}
        </label>
        <label className="pill" title="Rigid spin rate (rad/s) — a tumbling bubble">
          🔁 Spin
          <input type="range" min="0" max="6" step="0.2" value={params.spin}
            onChange={(e) => set('spin', parseFloat(e.target.value))} /> {params.spin.toFixed(1)} rad/s
        </label>
        <span className="small" style={{ alignSelf: 'center', color: 'var(--ink2)' }}>
          Wake draws a downwind tail (form drag); spin tumbles any elongation, so a single frame's
          tilt lies — but a series gives it away.
        </span>
      </div>
      </Drawer>
      )}

      {mode === 'expert' && readout && (
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
          <div className="label">Launcher imprint</div>
          <div>
            {readout.launcher === 'loop' ? (
              <>
                <strong>String loop</strong> — the bubble was born elongated along the loop; that
                imprint is {readout.age < 1.2 ? 'still ringing out' : 'ringing out'} as the shape
                relaxes toward the wind-only form
              </>
            ) : (
              <>
                <strong>Rigid wand</strong> — born round, so the shape you measure is wind &amp;
                gravity only, no launcher signature
              </>
            )}
          </div>
          <div className="label">Gravity sag vs. wind (the confound)</div>
          <div>
            Bo = {readout.bond.toFixed(2)}
            {readout.bond >= 0.6
              ? ' — gravity alone is stretching the bubble vertically, mimicking a wind signal'
              : ' — negligible sag; deformation is wind-dominated'}
          </div>
          <div className="label">Air-mass conservation</div>
          <div>{areaPct.toFixed(1)}% of rest area (pressure ↔ tension balance)</div>
          {readout.thickness != null && (
            <>
              <div className="label">Film wall (draining)</div>
              <div>
                {Math.max(0, readout.thickness).toFixed(0)} nm ·{' '}
                {((Math.max(0, readout.thickness) / readout.thickness0) * 100).toFixed(0)}% of start —
                it thins until it ruptures
              </div>
            </>
          )}
          <div className="label">Float vs. sink (film weight)</div>
          <div>
            {readout.vy > 6
              ? `sinking (${(readout.vy / PX_PER_MS).toFixed(2)} m/s) — a heavier film out-weighs its buoyancy`
              : readout.vy > 1.5
                ? 'settling slowly — the film just out-weighs the air it displaces'
                : readout.vy > -1.5
                  ? 'hanging — nearly neutrally buoyant, so the wind carries it'
                  : 'drifting up — this film is lighter than the air it displaces'}
          </div>
        </div>
      )}

      {mode === 'expert' && (
      <Drawer title="💡 What the readout means, and why every knob looks like wind">
        <div className="stack small" style={{ gap: 12 }}>
          <p style={{ margin: 0 }}>
            The <strong>applied → recovered</strong> row is POP's thesis in miniature: the wind that
            shaped the bubble is read straight back out of the shape the physics produced (they track
            with a lag set by the relaxation time τ). Because a drifting bubble only feels the{' '}
            <em>relative</em> wind, one snapshot can't separate wind from the bubble's own motion —
            which is exactly why POP's analyzer turns to <strong>video</strong>.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Every knob here can masquerade as wind:</strong> <strong>gravity (Bond number)</strong>{' '}
            stretches a big bubble vertically with no wind at all; <strong>film thickness</strong> sets the
            inertia, so a freshly pinched bubble <em>rings</em>; the <strong>launcher</strong> stamps the
            bubble with the loop's own elongation; a <strong>wake</strong> draws a downwind tail; and{' '}
            <strong>spin</strong> tumbles the whole shape. All are degenerate in one silhouette — to pull
            them apart you go the other way and read a <em>series</em> over time, which is what the
            recorder below does.
          </p>
        </div>
      </Drawer>
      )}

      <div className="card" style={{ margin: 0 }}>
        <h4 style={{ marginTop: 0 }}>🔎 Inverse: infer the environment from a series of shapes</h4>
        <p className="small" style={{ marginTop: 0 }}>
          <strong>Record &amp; analyze</strong> flies a bubble with the settings above, captures the
          shape it would show in each video frame, and reads the scene back out of that time-series —
          the reverse of everything else here. Each cue is recovered by its own signature in time.
        </p>
        {!report && (
          <p className="small" style={{ color: 'var(--ink2)' }}>
            Set up a scene (wind, launcher, film, spin…), then hit <strong>🎥 Record &amp; analyze</strong>.
          </p>
        )}
        {report && report.ok && (
          <div className="stack">
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              {report.findings.map((f, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{f}</li>
              ))}
            </ul>
            <div className="kv small">
              <div className="label">Wind — recovered vs. set</div>
              <div>
                {report.windSpeedMs.toFixed(1)} m/s {report.windDirDeg === 0 ? '→' : '←'} vs.{' '}
                <strong>{report.truth.windSpeed.toFixed(1)} m/s</strong> set
              </div>
              <div className="label">Launcher — recovered vs. set</div>
              <div>
                {report.launcher} vs. <strong>{report.truth.launcher === 'loop' ? 'string loop' : 'rigid wand'}</strong>{' '}
                {report.launcherIsLoop === (report.truth.launcher === 'loop') ? '✓' : '✗'}
              </div>
              <div className="label">Film ringing — recovered vs. set</div>
              <div>
                {report.ringing ? `yes (~${report.ringHz.toFixed(1)} Hz)` : 'no'} vs.{' '}
                <strong>{report.truth.film.toFixed(1)} µm film</strong>
              </div>
              <div className="label">Spin — recovered vs. set</div>
              <div>
                {report.spinning ? `${report.spinRate.toFixed(1)} rad/s` : 'none'} vs.{' '}
                <strong>{report.truth.spin.toFixed(1)} rad/s</strong>{' '}
                {report.spinning === report.truth.spin > 0.3 ? '✓' : ''}
              </div>
              <div className="label">Confidence</div>
              <div>
                {(report.confidence * 100).toFixed(0)}% ({report.nFrames} frames)
              </div>
            </div>
            <div className="footer small" style={{ padding: 0, border: 'none' }}>
              A single frame couldn't have told wind from sag from launcher from spin — but their
              distinct <em>time signatures</em> (steady drift, curvature, a fading imprint, a rotating
              tilt) pull them apart. That's POP's whole premise, run backwards.
            </div>

            {plan && (
              <div className="card" style={{ margin: 0 }}>
                <h4 style={{ marginTop: 0 }}>🎯 Coach — harder, better, faster, stronger</h4>
                <p className="small" style={{ marginTop: 0 }}>Pick a goal and POP reads this bubble, then ranks the levers to get there.</p>
                <div className="controls" style={{ gap: 8, borderTop: 'none', padding: 0, marginBottom: 12 }}>
                  {GOALS.map((g) => (
                    <button
                      key={g.key}
                      className={`btn small ${goal === g.key ? 'primary' : 'ghost'}`}
                      onClick={() => setGoal(g.key)}
                      title={g.hint ? `${g.label} — ${g.hint}` : g.label}
                    >
                      {g.icon} {g.label}
                    </button>
                  ))}
                </div>
                <div className="kv small" style={{ marginBottom: 12 }}>
                  <div className="label">{plan.goal.icon} {plan.goal.label}{plan.goal.hint ? ` (${plan.goal.hint})` : ''} — where it stands</div>
                  <div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', maxWidth: 240 }}>
                      <div style={{ width: `${plan.score}%`, height: '100%', background: 'var(--accent)' }} />
                    </div>
                    <span className="small" style={{ color: 'var(--ink2)' }}>{plan.score}/100 · {plan.summary}</span>
                  </div>
                </div>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {plan.levers.map((l, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <strong>{l.title}</strong>
                      {l.control ? <span className="tag" style={{ marginLeft: 8 }}>{l.control}</span> : null}
                      <div className="small" style={{ color: 'var(--ink2)', marginTop: 2 }}>{l.why}</div>
                    </li>
                  ))}
                </ol>
                {plan.caveat && (
                  <p className="small" style={{ color: 'var(--warn)', marginBottom: 0 }}>⚠️ {plan.caveat}</p>
                )}
                <Drawer title="🔬 What POP doesn't model yet — the next hypotheses to add" className="">
                  <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
                    {MODEL_GAPS.map((h, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>{h}</li>
                    ))}
                  </ul>
                </Drawer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export default BubblePhysics
