import React, { useEffect, useRef, useState } from 'react'
import WandEditor from './WandEditor'
import { computeMouthStats, swayPoints } from '../lib/physics.js'

// Simplified simulator that sketches an ellipse representing the bubble and
// shows how a wand string defined by control points sways in the wind.

export default function Simulator() {
  const [params, setParams] = useState({
    U: 0,
    jerk: 0,
    Rcm: 20,
    sigma: 0.03,
  })
  const canvasRef = useRef(null)
  const [metrics, setMetrics] = useState(null)
  const [wand, setWand] = useState([])
  const [t, setT] = useState(0)

  // simple animation timer for wand sway
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 0.016), 16)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const { c1 = 1, c2 = 0.3, rho = 1.2, mu = 1.8e-5 } =
      window.POP_PARAMS || {}
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)

    // draw swaying wand
    const swayed = swayPoints(wand, params.U, t)
    ctx.strokeStyle = '#5b6bff'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (swayed.length) {
      ctx.moveTo(swayed[0].x, swayed[0].y)
      for (let i = 1; i < swayed.length; i++) ctx.lineTo(swayed[i].x, swayed[i].y)
    }
    ctx.stroke()

    const stats = computeMouthStats(swayed)

    const R = params.Rcm / 100
    const We = (rho * params.U * params.U * R) / params.sigma
    const chi = 1 + (c1 * We) / (1 + c2 * We)
    const stretch = 1 + params.jerk
    const a = R * 100 * chi * stretch
    const b = R * 100 * (1 / stretch)
    ctx.save()
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate(stats.angle)
    ctx.strokeStyle = '#3ad1c9'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    const tau = (mu * R) / params.sigma
    setMetrics({ We, chi, tau, mouth: stats })
  }, [params, wand, t])

  const ui = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="stack">
      <div className="controls" style={{ gap: 16 }}>
        <label className="pill" title="Wind speed (m/s)">
          🌬️ U
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={params.U}
            onChange={(e) => ui('U', parseFloat(e.target.value))}
          />{' '}
          {params.U.toFixed(1)} m/s
        </label>
        <label className="pill" title="Launch stretch/jerk">
          🪄 Jerk
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.jerk}
            onChange={(e) => ui('jerk', parseFloat(e.target.value))}
          />{' '}
          {params.jerk.toFixed(2)}
        </label>
        <label className="pill" title="Bubble radius (cm)">
          ⚪ Ø
          <input
            type="range"
            min="5"
            max="80"
            step="1"
            value={params.Rcm}
            onChange={(e) => ui('Rcm', parseFloat(e.target.value))}
          />{' '}
          {params.Rcm} cm
        </label>
        <label className="pill" title="Surface tension (N/m)">
          σ
          <input
            type="range"
            min="0.015"
            max="0.04"
            step="0.001"
            value={params.sigma}
            onChange={(e) => ui('sigma', parseFloat(e.target.value))}
          />{' '}
          {params.sigma.toFixed(3)} N/m
        </label>
      </div>
      <div className="sim-wrap">
        <canvas ref={canvasRef} width={720} height={360}></canvas>
      </div>
      <WandEditor points={wand} onChange={setWand} />
      {metrics && (
        <div className="kv">
          <div className="label">Weber (We)</div>
          <div>{metrics.We.toFixed(2)}</div>
          <div className="label">Axis ratio χ</div>
          <div>{metrics.chi.toFixed(2)}</div>
          <div className="label">Relax time τ</div>
          <div>{metrics.tau.toFixed(2)} s</div>
          <div className="label">Mouth angle</div>
          <div>{(metrics.mouth.angle * 180 / Math.PI).toFixed(1)}°</div>
        </div>
      )}
    </div>
  )
}

