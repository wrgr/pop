import React, { useEffect, useRef, useState, useCallback, memo } from 'react'

const WandEditor = memo(function WandEditor({ points, onChange, width=720, height=180 }){
  const canvasRef = useRef(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragType, setDragType] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  // Initialize with two wands and a string loop if no points exist
  useEffect(() => {
    if (points.length === 0) {
      const defaultWands = createDefaultWandSetup(width, height)
      onChange(defaultWands)
    }
  }, [points.length, onChange, width, height])

  // Create default wand setup: two wands with a string loop between them
  const createDefaultWandSetup = useCallback((w, h) => {
    const wand1 = { x: w * 0.3, y: h * 0.5, angle: 0, type: 'wand1' }
    const wand2 = { x: w * 0.7, y: h * 0.5, angle: 0, type: 'wand2' }
    
    // Create string loop points between the wands
    const stringPoints = [
      { x: wand1.x + 20, y: wand1.y - 15, type: 'string' },
      { x: (wand1.x + wand2.x) / 2, y: h * 0.3, type: 'string' },
      { x: wand2.x - 20, y: wand2.y - 15, type: 'string' },
      { x: wand2.x - 20, y: wand2.y + 15, type: 'string' },
      { x: (wand1.x + wand2.x) / 2, y: h * 0.7, type: 'string' },
      { x: wand1.x + 20, y: wand1.y + 15, type: 'string' }
    ]
    
    return [wand1, wand2, ...stringPoints]
  }, [])

  // Memoize draw function to prevent unnecessary re-renders
  const draw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    
    // Background with subtle gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(108,123,255,0.08)')
    gradient.addColorStop(1, 'rgba(108,123,255,0.04)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, c.width, c.height)
    
    // Draw wands and string
    drawWandsAndString(ctx, points)
  }, [points, height])

  // Draw the wands and string loop with beautiful smooth curves
  const drawWandsAndString = useCallback((ctx, points) => {
    const wands = points.filter(p => p.type === 'wand1' || p.type === 'wand2')
    const stringPoints = points.filter(p => p.type === 'string')
    
    // Draw beautiful smooth string loop using cubic Bezier curves
    if (stringPoints.length > 2) {
      // Create smooth curve through all points
      ctx.strokeStyle = '#4a90e2'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      // Add shadow for depth
      ctx.shadowColor = 'rgba(74, 144, 226, 0.3)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      
      ctx.beginPath()
      
      if (stringPoints.length === 3) {
        // For 3 points, create a smooth triangle
        const p1 = stringPoints[0]
        const p2 = stringPoints[1]
        const p3 = stringPoints[2]
        
        ctx.moveTo(p1.x, p1.y)
        ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y)
        ctx.quadraticCurveTo(p2.x, p2.y, p1.x, p1.y)
      } else {
        // For more points, create smooth closed curve
        ctx.moveTo(stringPoints[0].x, stringPoints[0].y)
        
        for (let i = 0; i < stringPoints.length; i++) {
          const current = stringPoints[i]
          const next = stringPoints[(i + 1) % stringPoints.length]
          const afterNext = stringPoints[(i + 2) % stringPoints.length]
          
          // Calculate control points for smooth curves
          const dx1 = next.x - current.x
          const dy1 = next.y - current.y
          const dx2 = afterNext.x - next.x
          const dy2 = afterNext.y - next.y
          
          const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
          
          if (len1 > 0 && len2 > 0) {
            const tension = 0.3
            const cp1x = current.x + dx1 * tension
            const cp1y = current.y + dy1 * tension
            const cp2x = next.x - dx2 * tension
            const cp2y = next.y - dy2 * tension
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y)
          } else {
            ctx.lineTo(next.x, next.y)
          }
        }
      }
      
      ctx.closePath()
      ctx.stroke()
      
      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }
    
    // Draw beautiful wands with shadows and highlights
    wands.forEach((wand, index) => {
      const length = 45
      const endX = wand.x + Math.cos(wand.angle || 0) * length
      const endY = wand.y + Math.sin(wand.angle || 0) * length
      
      // Wand shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      
      // Wand body with gradient
      const wandGradient = ctx.createLinearGradient(wand.x, wand.y, endX, endY)
      wandGradient.addColorStop(0, '#ff6b6b')
      wandGradient.addColorStop(1, '#ee5a24')
      
      ctx.strokeStyle = wandGradient
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(wand.x, wand.y)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      
      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // Beautiful wand handle with highlight
      const handleGradient = ctx.createRadialGradient(wand.x, wand.y, 0, wand.x, wand.y, 8)
      handleGradient.addColorStop(0, '#ff8a80')
      handleGradient.addColorStop(0.7, '#ff6b6b')
      handleGradient.addColorStop(1, '#d84315')
      
      ctx.fillStyle = handleGradient
      ctx.beginPath()
      ctx.arc(wand.x, wand.y, 8, 0, Math.PI * 2)
      ctx.fill()
      
      // Handle highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.beginPath()
      ctx.arc(wand.x - 2, wand.y - 2, 3, 0, Math.PI * 2)
      ctx.fill()
      
      // Wand label
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`W${index + 1}`, wand.x, wand.y + 20)
    })
    
    // Draw beautiful string control points with depth
    stringPoints.forEach((p, i) => {
      // Point shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      
      // Point body with gradient
      const pointGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6)
      pointGradient.addColorStop(0, '#70d6ff')
      pointGradient.addColorStop(0.7, '#4a90e2')
      pointGradient.addColorStop(1, '#1976d2')
      
      ctx.fillStyle = pointGradient
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fill()
      
      // Point border
      ctx.strokeStyle = '#1565c0'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // Point highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.beginPath()
      ctx.arc(p.x - 2, p.y - 2, 2, 0, Math.PI * 2)
      ctx.fill()
      
      // Point number with better styling
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(i.toString(), p.x, p.y + 3)
    })
  }, [])

  useEffect(() => { 
    draw()
  }, [draw])

  // Add a new string point at a specific location
  const addStringPointAtLocation = useCallback((x, y) => {
    const stringPoints = points.filter(p => p.type === 'string')
    if (stringPoints.length < 2) return
    
    // Find the closest segment to insert the new point
    let minDist = Infinity
    let insertIndex = 0
    
    for (let i = 0; i < stringPoints.length; i++) {
      const current = stringPoints[i]
      const next = stringPoints[(i + 1) % stringPoints.length]
      
      // Calculate distance from point to line segment
      const dist = distanceToLineSegment(x, y, current.x, current.y, next.x, next.y)
      if (dist < minDist) {
        minDist = dist
        insertIndex = i
      }
    }
    
    // Insert the new point after the current point in the segment
    const stringStartIndex = points.findIndex(p => p.type === 'string')
    const newPoints = [...points]
    const insertPosition = stringStartIndex + insertIndex + 1
    
    newPoints.splice(insertPosition, 0, {
      x: x,
      y: y,
      type: 'string'
    })
    
    onChange(newPoints)
  }, [points, onChange])

  // Add a new string point in the middle of the longest segment
  const addStringPoint = useCallback(() => {
    const stringPoints = points.filter(p => p.type === 'string')
    if (stringPoints.length === 0) return
    
    // Add new point in the middle of the longest segment
    let maxDist = 0
    let insertIndex = 0
    
    for (let i = 0; i < stringPoints.length; i++) {
      const next = stringPoints[(i + 1) % stringPoints.length]
      const dist = Math.hypot(stringPoints[i].x - next.x, stringPoints[i].y - next.y)
      if (dist > maxDist) {
        maxDist = dist
        insertIndex = i
      }
    }
    
    const current = stringPoints[insertIndex]
    const next = stringPoints[(insertIndex + 1) % stringPoints.length]
    const midPoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
      type: 'string'
    }
    
    // Insert at the right position in the main points array
    const stringStartIndex = points.findIndex(p => p.type === 'string')
    const newPoints = [...points]
    newPoints.splice(stringStartIndex + insertIndex + 1, 0, midPoint)
    
    onChange(newPoints)
  }, [points, onChange])

  const removeLastStringPoint = useCallback(() => {
    const stringPoints = points.filter(p => p.type === 'string')
    if (stringPoints.length <= 3) return // Keep minimum loop
    
    const newPoints = points.filter(p => p !== stringPoints[stringPoints.length - 1])
    onChange(newPoints)
  }, [points, onChange])

  const resetWandSetup = useCallback(() => {
    const defaultWands = createDefaultWandSetup(width, height)
    onChange(defaultWands)
  }, [createDefaultWandSetup, onChange, width, height])

  // Calculate distance from point to line segment
  const distanceToLineSegment = useCallback((px, py, x1, y1, x2, y2) => {
    const A = px - x1
    const B = py - y1
    const C = x2 - x1
    const D = y2 - y1
    
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B)
    
    let param = dot / lenSq
    
    let xx, yy
    if (param < 0) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }
    
    const dx = px - xx
    const dy = py - yy
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  const onDown = useCallback((ev) => {
    const r = canvasRef.current.getBoundingClientRect()
    const x = ev.clientX - r.left, y = ev.clientY - r.top
    
    // Check if clicking on a wand
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      if (point.type === 'wand1' || point.type === 'wand2') {
        const dist = Math.hypot(point.x - x, point.y - y)
        if (dist < 20) {
          setDragIdx(i)
          setDragType('wand')
          setIsDragging(true)
          ev.preventDefault()
          return
        }
      }
    }
    
    // Check if clicking on a string point
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      if (point.type === 'string') {
        if (Math.hypot(point.x - x, point.y - y) < 15) {
          setDragIdx(i)
          setDragType('string')
          setIsDragging(true)
          ev.preventDefault()
          return
        }
      }
    }
    
    // If clicking on empty space, add a new string point there
    if (ev.ctrlKey || ev.metaKey) {
      addStringPointAtLocation(x, y)
    }
  }, [points, addStringPointAtLocation])

  const onMove = useCallback((ev) => {
    if (dragIdx === null || !isDragging) return
    
    const r = canvasRef.current.getBoundingClientRect()
    const x = ev.clientX - r.left, y = ev.clientY - r.top
    
    // Constrain to canvas bounds
    const clampedX = Math.max(10, Math.min(width - 10, x))
    const clampedY = Math.max(10, Math.min(height - 10, y))
    
    const np = [...points]
    if (dragType === 'wand') {
      // Update wand position
      np[dragIdx] = { ...np[dragIdx], x: clampedX, y: clampedY }
    } else if (dragType === 'string') {
      // Update string point position
      np[dragIdx] = { ...np[dragIdx], x: clampedX, y: clampedY }
    }
    
    onChange(np)
    ev.preventDefault()
  }, [dragIdx, dragType, isDragging, points, onChange, width, height])

  const onUp = useCallback((ev) => {
    setDragIdx(null)
    setDragType(null)
    setIsDragging(false)
    ev.preventDefault()
  }, [])

  return (
    <div className="stack">
      <div className="controls" style={{gap: 8}}>
        <span className="badge">✨ Beautiful Wand & String Editor</span>
        <button className="btn" onClick={addStringPoint}>➕ Add string point</button>
        <button className="btn" onClick={removeLastStringPoint}>➖ Remove string point</button>
        <button className="btn" onClick={resetWandSetup}>🔁 Reset wands</button>
      </div>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        onMouseDown={onDown} 
        onMouseMove={onMove} 
        onMouseUp={onUp} 
        onMouseLeave={onUp}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'crosshair',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      />
      <div className="small">
        <p><strong>🎯 Instructions:</strong></p>
        <ul>
          <li>Drag the <strong>red wand handles</strong> to position them</li>
          <li>Drag <strong>blue string points</strong> to shape the loop</li>
          <li>Add/remove string points to control loop complexity</li>
          <li>The string forms a <strong>smooth closed loop</strong> between the wands</li>
          <li>String curves smoothly between control points like a real cord</li>
          <li><strong>Ctrl+Click</strong> anywhere to add a new string point at that location</li>
        </ul>
        <p><strong>🔧 Status:</strong> {isDragging ? `Dragging ${dragType}` : 'Ready'} | Points: {points.length}</p>
      </div>
    </div>
  )
})

export default WandEditor
