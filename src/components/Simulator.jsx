import React, { useEffect, useRef, useState } from 'react'

// Simplified simulator that sketches an ellipse representing the bubble.
// The original file was truncated which left top-level returns and missing
// component structure. This version restores a functional React component
// so the app can run again.

export default function Simulator() {
  const [params, setParams] = useState({
    U: 0,
    dir: 0,
    jerk: 0,
    Rcm: 20,
    sigma: 0.03,
  })
  const canvasRef = useRef(null)

  useEffect(() => {
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#3ad1c9'
    ctx.lineWidth = 2
    ctx.beginPath()
    const a = params.Rcm * 2
    const b = params.Rcm * 2 * (1 - params.jerk * 0.5)
    ctx.ellipse(c.width / 2, c.height / 2, a, b, 0, 0, Math.PI * 2)
    ctx.stroke()
  }, [params])

  const ui = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="stack">
      <div className="controls" style={{ gap: 16 }}>
        <label className="pill">
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
        <label className="pill">
          🧭 Dir
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={params.dir}
            onChange={(e) => ui('dir', parseFloat(e.target.value))}
          />{' '}
          {params.dir}°
        </label>
        <label className="pill">
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
        <label className="pill">
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
        <label className="pill">
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
    </div>
  )
}

