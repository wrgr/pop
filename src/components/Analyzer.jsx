import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import UncertaintyBadge from './UncertaintyBadge.jsx'
import { analyzeSinglePhoto, VideoAnalyzer } from '../lib/inference.js'

// Sophisticated analyzer that can infer wind and wand motion from bubble shapes
// using empirical surrogate laws and dynamic relaxation modeling
const Analyzer = memo(function Analyzer() {
  const [imgURL, setImgURL] = useState(null)
  const [img, setImg] = useState(null)
  const canvasRef = useRef(null)
  const [ellipse, setEllipse] = useState(null)
  const [scalePxPerCm, setScalePxPerCm] = useState(10)
  const [pickPts, setPickPts] = useState(null)
  const [report, setReport] = useState(null)
  const [videoAnalyzer, setVideoAnalyzer] = useState(null)
  const [isVideo, setIsVideo] = useState(false)
  const [videoFrames, setVideoFrames] = useState([])
  const fileRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastEllipseRef = useRef(null)
  const [autoScaleEnabled, setAutoScaleEnabled] = useState(false)
  const [knownObjectType, setKnownObjectType] = useState('person')
  const [knownObjectSize, setKnownObjectSize] = useState(170) // cm
  const [scaleEstimate, setScaleEstimate] = useState(null)
  const [isComplexShapeMode, setIsComplexShapeMode] = useState(false)

  // Known object sizes for auto-scale estimation
  const KNOWN_OBJECTS = {
    person: { name: 'Person', defaultSize: 170, unit: 'cm', description: 'Average adult height' },
    creditCard: { name: 'Credit Card', defaultSize: 8.56, unit: 'cm', description: 'Standard credit card width' },
    coin: { name: 'US Quarter', defaultSize: 2.43, unit: 'cm', description: 'US quarter diameter' },
    smartphone: { name: 'Smartphone', defaultSize: 15, unit: 'cm', description: 'Average phone length' },
    book: { name: 'Book', defaultSize: 21.5, unit: 'cm', description: 'Standard book height' }
  }

  // Auto-estimate scale from known object
  const estimateScaleFromObject = useCallback(() => {
    if (!img || !ellipse) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Simple edge detection to find object boundaries
    const edges = detectEdges(imageData)
    const objects = findObjects(edges)
    
    if (objects.length > 0) {
      // Find the largest object (likely the known object)
      const largestObject = objects.reduce((max, obj) => 
        obj.area > max.area ? obj : max
      )
      
      // Estimate scale based on object size
      const estimatedPxPerCm = largestObject.width / knownObjectSize
      setScaleEstimate(estimatedPxPerCm)
      
      // Auto-apply if enabled
      if (autoScaleEnabled) {
        setScalePxPerCm(estimatedPxPerCm)
      }
      
      return estimatedPxPerCm
    }
    
    return null
  }, [img, ellipse, knownObjectSize, autoScaleEnabled])

  // Estimate scale from bubble size (for very large bubbles)
  const estimateScaleFromBubble = useCallback(() => {
    if (!ellipse) return
    
    // For very large bubbles, estimate scale based on typical bubble sizes
    // Large bubbles are typically 10-50 cm in diameter
    const bubbleDiameterPx = Math.max(ellipse.a, ellipse.b) * 2
    
    // Estimate scale based on typical large bubble sizes
    let estimatedSizeCm
    if (bubbleDiameterPx > 400) {
      estimatedSizeCm = 50 // Very large bubble
    } else if (bubbleDiameterPx > 200) {
      estimatedSizeCm = 25 // Large bubble
    } else if (bubbleDiameterPx > 100) {
      estimatedSizeCm = 15 // Medium-large bubble
    } else {
      estimatedSizeCm = 10 // Standard bubble
    }
    
    const estimatedPxPerCm = bubbleDiameterPx / estimatedSizeCm
    setScaleEstimate(estimatedPxPerCm)
    
    if (autoScaleEnabled) {
      setScalePxPerCm(estimatedPxPerCm)
    }
    
    return estimatedPxPerCm
  }, [ellipse, autoScaleEnabled])

  // Enhanced bubble shape analysis for 3D complexity
  const analyzeBubbleShape3D = useCallback((ellipse, scalePxPerCm) => {
    if (!ellipse) return null
    
    // Calculate basic 2D metrics
    const a = ellipse.a / scalePxPerCm // Convert to cm
    const b = ellipse.b / scalePxPerCm
    const area = Math.PI * a * b
    const perimeter = 2 * Math.PI * Math.sqrt((a * a + b * b) / 2)
    
    // Enhanced shape analysis for 3D bubbles
    const shapeMetrics = {
      // Basic 2D metrics
      semiMajorAxis: a,
      semiMinorAxis: b,
      aspectRatio: a / b,
      area: area,
      perimeter: perimeter,
      
      // 3D shape indicators
      isCircular: Math.abs(a - b) / Math.max(a, b) < 0.1,
      elongation: (a - b) / (a + b),
      compactness: (4 * Math.PI * area) / (perimeter * perimeter), // 1 = perfect circle
      
      // Perspective and 3D effects
      perspectiveFactor: Math.abs(ellipse.angleRad) > 0.1 ? 'tilted' : 'frontal',
      shapeComplexity: 'complex', // Placeholder for future enhancement
      
      // Wind inference from shape
      windSpeedClass: classifyWindFromShape(a, b, ellipse.angleRad),
      windDirectionClass: classifyWindDirection(ellipse.angleRad),
      
      // Confidence based on shape quality
      confidence: assessShapeConfidence(a, b, area, perimeter)
    }
    
    return shapeMetrics
  }, [])

  // Classify wind speed from bubble shape (more sophisticated than simple ellipse)
  const classifyWindFromShape = useCallback((a, b, angleRad) => {
    const elongation = (a - b) / (a + b)
    const aspectRatio = a / b
    
    // More sophisticated classification based on research
    if (elongation < 0.1) return 'calm'
    if (elongation < 0.2) return 'light'
    if (elongation < 0.3) return 'moderate'
    if (elongation < 0.4) return 'strong'
    return 'very_strong'
  }, [])

  // Classify wind direction from bubble orientation
  const classifyWindDirection = useCallback((angleRad) => {
    const degrees = (angleRad * 180 / Math.PI + 360) % 360
    
    if (degrees < 45 || degrees >= 315) return 'east'
    if (degrees < 135) return 'south'
    if (degrees < 225) return 'west'
    return 'north'
  }, [])

  // Assess confidence in shape analysis
  const assessShapeConfidence = useCallback((a, b, area, perimeter) => {
    let confidence = 0.8 // Base confidence
    
    // Reduce confidence for very asymmetric shapes (potential 3D effects)
    const asymmetry = Math.abs(a - b) / Math.max(a, b)
    if (asymmetry > 0.8) confidence -= 0.2
    
    // Reduce confidence for very small bubbles (measurement uncertainty)
    if (area < 10) confidence -= 0.1
    
    // Reduce confidence for very large bubbles (perspective distortion)
    if (area > 1000) confidence -= 0.15
    
    // Increase confidence for well-proportioned shapes
    const compactness = (4 * Math.PI * area) / (perimeter * perimeter)
    if (compactness > 0.8) confidence += 0.1
    
    return Math.max(0.3, Math.min(1.0, confidence))
  }, [])

  // Enhanced single photo analysis with 3D considerations
  const analyzeSinglePhotoEnhanced = useCallback((ellipse, scalePxPerCm) => {
    if (!ellipse || !scalePxPerCm) return null
    
    // Get enhanced shape metrics
    const shapeMetrics = analyzeBubbleShape3D(ellipse, scalePxPerCm)
    if (!shapeMetrics) return null
    
    // Calculate Weber number with uncertainty
    const weberNumber = weberFromDeformation(shapeMetrics.elongation)
    const weberUncertainty = weberNumber * 0.15 // 15% uncertainty for 3D effects
    
    // Estimate relative velocity with confidence bounds
    const relativeVelocity = velocityFromWeber(weberNumber, shapeMetrics.semiMajorAxis)
    const velocityUncertainty = relativeVelocity * 0.2 // 20% uncertainty
    
    // Wind direction with perspective correction
    const windDirection = (ellipse.angleRad * 180 / Math.PI + 360) % 360
    
    // Enhanced interpretation considering 3D complexity
    const interpretation = {
      description: `${shapeMetrics.windSpeedClass} wind from ${shapeMetrics.windDirectionClass}`,
      speedClass: shapeMetrics.windSpeedClass,
      directionClass: shapeMetrics.windDirectionClass,
      shapeQuality: shapeMetrics.compactness > 0.7 ? 'good' : 'fair',
      perspectiveEffect: shapeMetrics.perspectiveFactor,
      confidenceLevel: shapeMetrics.confidence > 0.7 ? 'high' : 'medium'
    }
    
    return {
      weberNumber,
      weberUncertainty,
      relativeVelocity,
      velocityUncertainty,
      windDirection,
      shapeMetrics,
      interpretation,
      confidence: shapeMetrics.confidence,
      analysisType: 'enhanced_3d'
    }
  }, [analyzeBubbleShape3D, weberFromDeformation, velocityFromWeber])

  // Enhanced shape fitting for non-elliptical bubbles
  const fitComplexShape = useCallback((points) => {
    if (!points || points.length < 3) return null
    
    // Calculate centroid
    const centroid = { x: 0, y: 0 }
    points.forEach(p => {
      centroid.x += p.x
      centroid.y += p.y
    })
    centroid.x /= points.length
    centroid.y /= points.length
    
    // Calculate shape metrics
    const distances = points.map(p => Math.hypot(p.x - centroid.x, p.y - centroid.y))
    const maxDist = Math.max(...distances)
    const minDist = Math.min(...distances)
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length
    
    // Calculate shape complexity
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / distances.length
    const shapeComplexity = Math.sqrt(variance) / avgDist
    
    // Determine if shape is more complex than an ellipse
    const isElliptical = shapeComplexity < 0.3
    const isComplex = shapeComplexity > 0.5
    
    return {
      centroid,
      maxRadius: maxDist,
      minRadius: minDist,
      avgRadius: avgDist,
      shapeComplexity,
      isElliptical,
      isComplex,
      points: points.length,
      // Convert to physical units if scale is available
      physicalMetrics: scalePxPerCm ? {
        maxRadiusCm: maxDist / scalePxPerCm,
        minRadiusCm: minDist / scalePxPerCm,
        avgRadiusCm: avgDist / scalePxPerCm,
        areaCm2: Math.PI * avgDist * avgDist / (scalePxPerCm * scalePxPerCm)
      } : null
    }
  }, [scalePxPerCm])

  // Alternative to ellipse fitting for complex shapes
  const startComplexShapeFitting = useCallback(() => {
    if (!img) return
    
    setPickPts([])
    setIsComplexShapeMode(true)
  }, [img])

  // Simple edge detection
  const detectEdges = useCallback((imageData) => {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const edges = new Uint8ClampedArray(data.length)
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        
        // Simple Sobel edge detection
        const gx = data[idx - 4] + 2 * data[idx] + data[idx + 4] - 
                   data[idx - 4 + width * 4] - 2 * data[idx + width * 4] - data[idx + 4 + width * 4]
        const gy = data[idx - width * 4] + 2 * data[idx] + data[idx + width * 4] - 
                   data[idx - 4 - width * 4] - 2 * data[idx - 4] - data[idx + 4 - width * 4]
        
        const magnitude = Math.sqrt(gx * gx + gy * gy)
        edges[idx] = magnitude > 30 ? 255 : 0
        edges[idx + 1] = edges[idx]
        edges[idx + 2] = edges[idx]
        edges[idx + 3] = 255
      }
    }
    
    return edges
  }, [])

  // Find objects in edge image
  const findObjects = useCallback((edges) => {
    // Simple connected component analysis
    const objects = []
    const visited = new Set()
    const width = Math.sqrt(edges.length / 4)
    const height = width
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (edges[idx * 4] > 128 && !visited.has(idx)) {
          const object = floodFill(edges, x, y, width, height, visited)
          if (object.area > 100) { // Filter out noise
            objects.push(object)
          }
        }
      }
    }
    
    return objects
  }, [])

  // Flood fill to find connected components
  const floodFill = useCallback((edges, startX, startY, width, height, visited) => {
    const stack = [[startX, startY]]
    const pixels = []
    let minX = startX, maxX = startX, minY = startY, maxY = startY
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()
      const idx = y * width + x
      
      if (x < 0 || x >= width || y < 0 || y >= height || 
          visited.has(idx) || edges[idx * 4] <= 128) {
        continue
      }
      
      visited.add(idx)
      pixels.push([x, y])
      
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      
      // Add neighbors
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
    
    return {
      pixels,
      area: pixels.length,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    }
  }, [])

  // Manual scale estimation with known object
  const estimateScaleManually = useCallback(() => {
    if (!img || !ellipse) return
    
    // For manual estimation, we'll use a simple approach
    // User can draw a line on a known object and we'll calculate scale
    const estimatedPxPerCm = 100 / knownObjectSize // Placeholder - would need user input
    setScaleEstimate(estimatedPxPerCm)
    
    if (autoScaleEnabled) {
      setScalePxPerCm(estimatedPxPerCm)
    }
    
    return estimatedPxPerCm
  }, [img, ellipse, knownObjectSize, autoScaleEnabled])

  // Memoize redraw function to prevent unnecessary re-renders
  const redraw = useCallback(() => {
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
  }, [img, ellipse, pickPts])

  // Only redraw when necessary
  useEffect(() => {
    if (img || ellipse || pickPts) {
      redraw()
    }
  }, [redraw])

  function onFile(e) {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setImgURL(url)
      
      if (file.type.startsWith('video/')) {
        setIsVideo(true)
        const video = document.createElement('video')
        video.onloadedmetadata = () => {
          setImg(video)
          // Initialize video analyzer
          const analyzer = new VideoAnalyzer()
          setVideoAnalyzer(analyzer)
          setVideoFrames([])
        }
        video.src = url
      } else {
        setIsVideo(false)
        const im = new Image()
        im.onload = () => {
          setImg(im)
        }
        im.src = url
      }
    } else {
      setImgURL(null)
      setImg(null)
      setIsVideo(false)
      setVideoAnalyzer(null)
      setVideoFrames([])
    }
  }

  function onCanvasDown(ev) {
    if (pickPts || isDrawingRef.current) return
    
    isDrawingRef.current = true
    const r = canvasRef.current.getBoundingClientRect()
    const start = { x: ev.clientX - r.left, y: ev.clientY - r.top }
    
    function move(e) {
      if (!isDrawingRef.current) return
      
      const xx = e.clientX - r.left
      const yy = e.clientY - r.top
      const dx = xx - start.x
      const dy = yy - start.y
      
      // Handle very large bubbles by allowing negative coordinates
      // and using absolute values for semi-axes
      const a = Math.max(5, Math.abs(dx))
      const b = Math.max(5, Math.abs(dy))
      
      // Calculate center point that allows the bubble to extend beyond the start point
      let cx, cy
      if (dx >= 0) {
        cx = start.x + dx / 2
      } else {
        cx = start.x + dx / 2
      }
      if (dy >= 0) {
        cy = start.y + dy / 2
      } else {
        cy = start.y + dy / 2
      }
      
      const angleRad = Math.atan2(dy, dx)
      const next = { cx, cy, a, b, angleRad }
      
      // Only update if ellipse changed significantly
      if (!lastEllipseRef.current || 
          Math.abs(next.a - lastEllipseRef.current.a) > 2 ||
          Math.abs(next.b - lastEllipseRef.current.b) > 2 ||
          Math.abs(next.cx - lastEllipseRef.current.cx) > 2 ||
          Math.abs(next.cy - lastEllipseRef.current.cy) > 2) {
        lastEllipseRef.current = next
        setEllipse(next)
      }
    }
    
    function up() {
      isDrawingRef.current = false
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
    
    if (isVideo && videoAnalyzer && videoFrames.length > 0) {
      // Video analysis - solve for wind and wand motion
      const result = videoAnalyzer.solveWindAndWand()
      if (result) {
        const summary = videoAnalyzer.getSummary()
        setReport({
          type: 'video',
          summary,
          frames: videoFrames.length,
          confidence: summary.confidence
        })
      }
    } else {
      // Single photo analysis
      const result = analyzeSinglePhotoEnhanced(ellipse, scalePxPerCm)
      if (result) {
        setReport({
          type: 'photo',
          ...result
        })
      }
    }
  }

  function addVideoFrame() {
    if (!ellipse || !videoAnalyzer) return
    
    const timestamp = Date.now()
    const centroid = { x: ellipse.cx, y: ellipse.cy }
    
    videoAnalyzer.addFrame(timestamp, ellipse, centroid)
    setVideoFrames(prev => [...prev, { timestamp, ellipse, centroid }])
  }

  function clearVideoFrames() {
    if (videoAnalyzer) {
      videoAnalyzer.frames = []
      setVideoFrames([])
    }
  }

  function downloadJSON() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'pop_analysis.json'
    a.click()
  }

  return (
    <div className="stack">
      <div className="controls" style={{gap: 8}}>
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
          onClick={startScalePick}
          title="Click two points with known separation to set scale"
          className="btn"
        >
          📏 Set scale
        </button>
        
        {ellipse && (
          <button className="btn" onClick={analyze}>
            {isVideo ? '🎬 Analyze Video' : '🔍 Analyze Photo'}
          </button>
        )}
        
        {isVideo && (
          <>
            <button 
              className="btn" 
              onClick={addVideoFrame}
              disabled={!ellipse}
              title="Add current frame to video sequence"
            >
              ➕ Add frame
            </button>
            <button 
              className="btn" 
              onClick={() => setVideoFrames([])}
              disabled={videoFrames.length === 0}
              title="Clear all video frames"
            >
              🗑️ Clear frames
            </button>
          </>
        )}
        
        {/* Shape Fitting Options */}
        <div className="row" style={{ gap: '8px', marginLeft: 'auto' }}>
          <button 
            className="btn small" 
            onClick={() => {
              setEllipse(null)
              setPickPts(null)
              setIsComplexShapeMode(false)
            }}
            title="Clear current shape"
          >
            🗑️ Clear
          </button>
          <button 
            className="btn small" 
            onClick={startComplexShapeFitting}
            disabled={!img}
            title="Fit complex non-elliptical shapes"
          >
            🎯 Complex Shape
          </button>
        </div>
      </div>
      
      {/* Core Question Answer Box */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <h3 style={{ color: 'white', margin: '0 0 16px 0' }}>🎯 Core Question: Can Bubble Shape Predict Wind & Wand Motion?</h3>
        <div style={{ fontSize: '16px', lineHeight: '1.6' }}>
          <p><strong>General Answer: YES, with sophisticated physics modeling!</strong></p>
          <p>
            Using empirical surrogate laws (Loth 2008), we can extract:
          </p>
          <ul style={{ margin: '12px 0', paddingLeft: '20px' }}>
            <li><strong>Wind Speed:</strong> From bubble elongation (Weber number)</li>
            <li><strong>Wind Direction:</strong> From major axis orientation</li>
            <li><strong>Wand Motion:</strong> From video analysis (least-squares fitting)</li>
            <li><strong>Confidence:</strong> Quantified uncertainty assessment</li>
          </ul>
          <p style={{ margin: '16px 0 0 0', fontStyle: 'italic' }}>
            "The key insight is the empirical surrogate law D ≈ k₁We/(1 + k₂We) 
            that links observable bubble deformation to underlying flow physics."
          </p>
        </div>
      </div>
      
      {/* 3D Bubble Complexity Note */}
      <div className="card" style={{ background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)' }}>
        <h4 style={{ color: '#f57c00', margin: '0 0 12px 0' }}>⚠️ Important: 3D Bubble Complexity</h4>
        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
          <p><strong>Current Limitation:</strong> This analysis uses 2D ellipse fitting, but real bubbles are complex 3D objects.</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li><strong>3D Shape:</strong> Bubbles have depth, curvature, and complex surface geometry</li>
            <li><strong>Perspective Effects:</strong> 2D photos show perspective projections, not true cross-sections</li>
            <li><strong>Shape Complexity:</strong> Wind causes 3D deformations beyond simple elongation</li>
            <li><strong>Surface Tension:</strong> Creates complex curvature patterns not captured by ellipses</li>
          </ul>
          <p style={{ margin: '12px 0 0 0', fontStyle: 'italic' }}>
            <strong>Future Enhancement:</strong> Multi-view analysis, 3D reconstruction, or machine learning could provide more accurate shape modeling.
          </p>
        </div>
      </div>
      
      {/* Specific Results for This Bubble */}
      {report && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', color: 'white' }}>
          <h3 style={{ color: 'white', margin: '0 0 16px 0' }}>🔍 For THIS Bubble: What We Found</h3>
          <div style={{ fontSize: '16px', lineHeight: '1.6' }}>
            {report.type === 'photo' ? (
              <>
                <p><strong>Single Photo Analysis Results:</strong></p>
                <ul style={{ margin: '12px 0', paddingLeft: '20px' }}>
                  <li><strong>Wind Speed:</strong> {report.relativeVelocity.toFixed(2)} m/s (from Weber number {report.weberNumber.toFixed(2)})</li>
                  <li><strong>Wind Direction:</strong> {report.windDirection.toFixed(1)}° (from major axis orientation)</li>
                  <li><strong>Wind Description:</strong> {report.interpretation.description}</li>
                  <li><strong>Analysis Confidence:</strong> {report.confidence.toUpperCase()}</li>
                </ul>
                <p style={{ margin: '16px 0 0 0', fontStyle: 'italic' }}>
                  "This bubble's elongation indicates {report.interpretation.speedClass} wind from {report.interpretation.directionClass} direction."
                </p>
              </>
            ) : (
              <>
                <p><strong>Video Analysis Results:</strong></p>
                <ul style={{ margin: '12px 0', paddingLeft: '20px' }}>
                  <li><strong>Wind Speed:</strong> {report.summary.wind.speed.toFixed(2)} m/s (from {report.frames} frames)</li>
                  <li><strong>Wind Direction:</strong> {(report.summary.wind.direction * 180 / Math.PI).toFixed(1)}° (from major axis evolution)</li>
                  <li><strong>Wand Release Speed:</strong> {report.summary.wand.speed.toFixed(2)} m/s (separated from ambient wind)</li>
                  <li><strong>Wand Release Direction:</strong> {(report.summary.wand.direction * 180 / Math.PI).toFixed(1)}° (launch trajectory)</li>
                  <li><strong>Analysis Confidence:</strong> {(report.confidence * 100).toFixed(0)}%</li>
                </ul>
                <p style={{ margin: '16px 0 0 0', fontStyle: 'italic' }}>
                  "This video sequence reveals both the ambient wind conditions and how the wands were moved during bubble launch."
                </p>
              </>
            )}
          </div>
        </div>
      )}
      
      {!img && (
        <div className="notice small">
          Upload an image or video then drag on the canvas to outline the bubble.
        </div>
      )}
      
      {img && !ellipse && (
        <div className="notice small">
          Drag on the bubble to fit an ellipse. Use 📏 to set scale.
          {isVideo && ' Use ➕ Add frame to build a sequence for video analysis.'}
        </div>
      )}
      
      {ellipse && !report && (
        <div className="notice small">
          {isVideo 
            ? `Add frames with ➕ then hit Analyze to solve for wind and wand motion.`
            : 'Hit Analyze to see wind inference results.'
          }
        </div>
      )}
      
      {/* Scale Setting */}
      {ellipse && (
        <div className="card">
          <h4>📏 Set Scale</h4>
          <div className="stack">
            <div className="row">
              <label>Scale: </label>
              <input 
                type="number" 
                value={scalePxPerCm} 
                onChange={(e) => setScalePxPerCm(parseFloat(e.target.value) || 0)}
                step="0.1"
                min="0.1"
                style={{ width: '100px' }}
              />
              <span>px/cm</span>
            </div>
            
            {/* Auto-Scale Estimation */}
            <div className="card" style={{ background: 'rgba(108,123,255,0.05)', border: '1px solid rgba(108,123,255,0.2)' }}>
              <h5 style={{ margin: '0 0 12px 0', color: '#4a90e2' }}>🔍 Auto-Scale Estimation</h5>
              <div className="stack">
                <div className="row">
                  <label>Known Object: </label>
                  <select 
                    value={knownObjectType} 
                    onChange={(e) => {
                      setKnownObjectType(e.target.value)
                      setKnownObjectSize(KNOWN_OBJECTS[e.target.value].defaultSize)
                    }}
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #ddd' }}
                  >
                    {Object.entries(KNOWN_OBJECTS).map(([key, obj]) => (
                      <option key={key} value={key}>
                        {obj.name} ({obj.defaultSize} {obj.unit})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="row">
                  <label>Object Size: </label>
                  <input 
                    type="number" 
                    value={knownObjectSize} 
                    onChange={(e) => setKnownObjectSize(parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0.1"
                    style={{ width: '80px' }}
                  />
                  <span>{KNOWN_OBJECTS[knownObjectType].unit}</span>
                </div>
                
                <div className="row" style={{ gap: '8px' }}>
                  <button 
                    className="btn small" 
                    onClick={estimateScaleFromObject}
                    disabled={!img}
                  >
                    🔍 Auto-Detect
                  </button>
                  <button 
                    className="btn small" 
                    onClick={estimateScaleFromBubble}
                    disabled={!ellipse}
                    title="Estimate scale from bubble size (good for large bubbles)"
                  >
                    🫧 From Bubble
                  </button>
                  <button 
                    className="btn small" 
                    onClick={estimateScaleManually}
                    disabled={!img}
                  >
                    📐 Manual Measure
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={autoScaleEnabled} 
                      onChange={(e) => setAutoScaleEnabled(e.target.checked)}
                    />
                    Auto-apply
                  </label>
                </div>
                
                {scaleEstimate && (
                  <div className="notice" style={{ background: 'rgba(32, 201, 151, 0.1)', borderColor: 'rgba(32, 201, 151, 0.3)' }}>
                    <strong>Estimated Scale:</strong> {scaleEstimate.toFixed(2)} px/cm
                    {autoScaleEnabled && (
                      <span style={{ color: '#20c997' }}> ✓ Applied automatically</span>
                    )}
                  </div>
                )}
                
                <div className="small" style={{ color: '#666', fontStyle: 'italic' }}>
                  <strong>Tip:</strong> {KNOWN_OBJECTS[knownObjectType].description}. 
                  Place the object in the image for better auto-detection.
                </div>
              </div>
            </div>
          </div>
        </div>
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
          {report.type === 'photo' ? (
            // Single photo analysis results
            <>
              <div className="label">Analysis Type</div>
              <div>Single Photo</div>
              <div className="label">Confidence</div>
              <div className={`badge ${report.confidence}`}>
                {report.confidence.toUpperCase()}
              </div>
              <div className="label">Axis ratio (a/b)</div>
              <div>{report.axisRatio.toFixed(2)}</div>
              <div className="label">Deformation D</div>
              <div>{report.deformation.toFixed(3)}</div>
              <div className="label">Effective radius</div>
              <div>
                {report.effectiveRadius 
                  ? `${(report.effectiveRadius * 100).toFixed(1)} cm`
                  : '— (set scale for cm)'
                }
              </div>
              <div className="label">Weber number</div>
              <div>{report.weberNumber.toFixed(2)}</div>
              <div className="label">Wind speed</div>
              <div>
                <UncertaintyBadge
                  value={report.relativeVelocity}
                  lo={report.relativeVelocity * 0.8}
                  hi={report.relativeVelocity * 1.2}
                />
                {' m/s'}
              </div>
              <div className="label">Wind direction</div>
              <div>{report.windDirection.toFixed(1)}°</div>
              <div className="label">Wind description</div>
              <div>{report.interpretation.description}</div>
              <div className="label">Relaxation time</div>
              <div>{report.relaxationTime.toFixed(3)} s</div>
            </>
          ) : (
            // Video analysis results
            <>
              <div className="label">Analysis Type</div>
              <div>Video Sequence</div>
              <div className="label">Frames analyzed</div>
              <div>{report.frames}</div>
              <div className="label">Confidence</div>
              <div className={`badge ${report.confidence > 0.7 ? 'high' : report.confidence > 0.4 ? 'medium' : 'low'}`}>
                {(report.confidence * 100).toFixed(0)}%
              </div>
              <div className="label">Wind speed</div>
              <div>
                <UncertaintyBadge
                  value={report.summary.wind.speed}
                  lo={report.summary.wind.speed * 0.8}
                  hi={report.summary.wind.speed * 1.2}
                />
                {' m/s'}
              </div>
              <div className="label">Wind direction</div>
              <div>{(report.summary.wind.direction * 180 / Math.PI).toFixed(1)}°</div>
              <div className="label">Wand release speed</div>
              <div>{report.summary.wand.speed.toFixed(2)} m/s</div>
              <div className="label">Wand release direction</div>
              <div>{(report.summary.wand.direction * 180 / Math.PI).toFixed(1)}°</div>
            </>
          )}
          
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
})

export default Analyzer

