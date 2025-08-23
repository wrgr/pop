import React, { useEffect, useRef, useState } from 'react'
import UncertaintyBadge from './UncertaintyBadge.jsx'

// Restored analyzer with manual ellipse drawing, scale setting and
// basic wind estimation from the selected bubble outline.
export default function Analyzer() {
  const [imgURL, setImgURL] = useState(null)
  const [img, setImg] = useState(null)
  const canvasRef = useRef(null)
  const [ellipse, setEllipse] = useState(null)
  const [scalePxPerCm, setScalePxPerCm] = useState(null)
  const [pickPts, setPickPts] = useState(null)
  const [report, setReport] = useState(null)
  const fileRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    redraw()
  }, [img, ellipse, pickPts])

  function onFile(e) {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setImgURL(url)
      const im = new Image()
      im.onload = () => {
        setImg(im)
        redraw()
      }
      im.src = url
    } else {
      setImgURL(null)
      setImg(null)
    }
  }

  function redraw() {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    if (img) ctx.drawImage(img, 0, 0, c.width, c.height)
    if (ellipse) {
      ctx.strokeStyle = '#ff7abc'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(
        ellipse.cx,
        ellipse.cy,
        ellipse.a,
        ellipse.b,
        ellipse.angleRad,
        0,
        Math.PI * 2
      )
      ctx.stroke()
    }
    if (pickPts) {
      ctx.fillStyle = '#70d6ff'
      pickPts.forEach((p) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  }

  function onCanvasDown(ev) {
    if (pickPts) return
    const r = canvasRef.current.getBoundingClientRect()
    const start = { x: ev.clientX - r.left, y: ev.clientY - r.top }
    function move(e) {
      const xx = e.clientX - r.left
      const yy = e.clientY - r.top
      const dx = xx - start.x
      const dy = yy - start.y
      const a = Math.max(5, Math.abs(dx))
      const b = Math.max(5, Math.abs(dy))
      const angleRad = Math.atan2(dy, dx)
      const next = { cx: start.x, cy: start.y, a, b, angleRad }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => setEllipse(next))
    }
    function up() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function startScalePick() {
    setPickPts([])
  }

  function onCanvasClick(ev) {
    if (!pickPts) return
    const r = canvasRef.current.getBoundingClientRect()
    const pt = { x: ev.clientX - r.left, y: ev.clientY - r.top }
    setPickPts((p) => {
      const np = [...p, pt]
      if (np.length === 2) {
        const d = Math.hypot(np[0].x - np[1].x, np[0].y - np[1].y)
        const cm = parseFloat(prompt('Real distance in cm:', '10'))
        if (cm > 0) setScalePxPerCm(d / cm)
        setPickPts(null)
      }
      return np
    })
  }

  function analyze() {
    if (!ellipse) return
    const { c1 = 1, c2 = 0.3, rho = 1.2, sigma = 0.03, Rf = 0.2 } =
      window.POP_PARAMS || {}
    const major = Math.max(ellipse.a, ellipse.b)
    const minor = Math.min(ellipse.a, ellipse.b)
    const axisRatio = major / minor
    const D = (major - minor) / (major + minor)
    const We = (axisRatio - 1) / (c1 - c2 * (axisRatio - 1))
    const Rm = scalePxPerCm
      ? Math.sqrt(ellipse.a * ellipse.b) / scalePxPerCm / 100
      : Rf
    const U = Math.sqrt((We * sigma) / (rho * Rm))
    const rep = {
      axisRatio: axisRatio.toFixed(2),
      D: D.toFixed(3),
      Rcm: scalePxPerCm ? Rm * 100 : null,
      wind: {
        We,
        U,
        Ulo: U * 0.9,
        Uhi: U * 1.1,
        class: windClass(U),
      },
    }
    setReport(rep)
  }

  function windClass(U) {
    if (U < 0.3) return 'calm'
    if (U < 1.5) return 'light air'
    if (U < 3.3) return 'light breeze'
    if (U < 5.5) return 'gentle breeze'
    return 'windy'
  }

  function downloadJSON() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'pop_report.json'
    a.click()
  }

  return (
    <div className="stack">
      <div className="controls" style={{ gap: 12 }}>
        <label className="btn" title="Upload a bubble photo or video">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={onFile}
          />
          <span>📎 Choose photo/video</span>
        </label>
        <button
          className="btn"
          onClick={analyze}
          disabled={!ellipse}
          title="Estimate wind from the drawn ellipse"
        >
          🔍 Analyze
        </button>
        <button
          className="btn"
          onClick={startScalePick}
          title="Click two points with known separation to set scale"
        >
          📏 Set scale
        </button>
        <span className="badge">
          Vision: {window.__cvReady ? 'OpenCV.js ready' : 'manual'}
        </span>
      </div>
      {!img && (
        <div className="notice small">
          Upload an image then drag on the canvas to outline the bubble.
        </div>
      )}
      {img && !ellipse && (
        <div className="notice small">
          Drag on the bubble to fit an ellipse. Use 📏 to set scale.
        </div>
      )}
      {ellipse && !report && (
        <div className="notice small">Hit Analyze to see wind results.</div>
      )}
      <canvas
        ref={canvasRef}
        width={720}
        height={440}
        onMouseDown={onCanvasDown}
        onClick={onCanvasClick}
      />
      {report && (
        <div className="kv">
          <div className="label">Axis ratio (a/b)</div>
          <div>{report.axisRatio}</div>
          <div className="label">Deformation D</div>
          <div>{report.D}</div>
          <div className="label">Equiv. radius R</div>
          <div>
            {report.Rcm ? `${report.Rcm.toFixed(1)} cm` : '— (set scale for cm)'}
          </div>
          <div className="label">Wind class</div>
          <div>{report.wind.class}</div>
          <div className="label">Weber (We)</div>
          <div>{report.wind.We.toFixed(2)}</div>
          <div className="label">Wind speed U (m/s)</div>
          <div>
            <UncertaintyBadge
              value={report.wind.U}
              lo={report.wind.Ulo}
              hi={report.wind.Uhi}
            />
          </div>
          <div className="label">Download</div>
          <div>
            <button className="btn" onClick={downloadJSON}>
              ⬇️ JSON
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

