import React, { useEffect, useRef, useState } from 'react'

export default function WandEditor({ points, onChange, width = 720, height = 180 }) {
  const canvasRef = useRef(null)
  const [dragIdx, setDragIdx] = useState(null)

  useEffect(() => {
    draw()
  }, [points])

  function draw() {
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = 'rgba(108,123,255,0.06)'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#5b6bff'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (points.length) {
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
    }
    ctx.stroke()
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#5b6bff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  function addPoint() {
    onChange([...points, { x: width * 0.5, y: height * 0.5 }])
  }
  function removeLast() {
    if (points.length) onChange(points.slice(0, -1))
  }
  function resetRect() {
    const cx = width * 0.5,
      cy = height * 0.6,
      span = 220,
      drop = 100
    onChange([
      { x: cx - span / 2, y: cy },
      { x: cx - span / 2, y: cy + drop },
      { x: cx + span / 2, y: cy + drop },
      { x: cx + span / 2, y: cy },
    ])
  }

  function onDown(ev) {
    const r = canvasRef.current.getBoundingClientRect()
    const x = ev.clientX - r.left,
      y = ev.clientY - r.top
    let hit = -1
    for (let i = 0; i < points.length; i++) {
      if (Math.hypot(points[i].x - x, points[i].y - y) < 10) {
        hit = i
        break
      }
    }
    setDragIdx(hit)
  }
  function onMove(ev) {
    if (dragIdx == null) return
    const r = canvasRef.current.getBoundingClientRect()
    const x = ev.clientX - r.left,
      y = ev.clientY - r.top
    const np = [...points]
    np[dragIdx] = { x, y }
    onChange(np)
  }
  function onUp() {
    setDragIdx(null)
  }

  return (
    <div className="stack">
      <div className="controls" style={{ gap: 8 }}>
        <span className="badge">Wand string editor</span>
        <button className="btn" onClick={addPoint}>
          ➕ Add point
        </button>
        <button className="btn" onClick={removeLast}>
          ➖ Remove last
        </button>
        <button className="btn" onClick={resetRect}>
          🔁 Reset to loop
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      />
    </div>
  )
}
