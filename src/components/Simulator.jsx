import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import WandEditor from './WandEditor'
import { computeMouthStats, swayPoints } from '../lib/physics.js'
import { deformationFromWeber, weberFromVelocity, effectiveRadius } from '../lib/inference.js'

// Sophisticated simulator that predicts bubble shapes from wind and wand parameters
// using empirical surrogate laws and dynamic relaxation modeling
const Simulator = memo(function Simulator() {
  const [params, setParams] = useState({
    U: 0,
    jerk: 0,
    Rcm: 20,
    sigma: 0.03,
    rho: 1.2,
    muEff: 1.8e-5,
    // Bubble solution parameters
    soapConcentration: 2.0,  // % by weight
    temperature: 20,          // °C
    humidity: 50,             // % relative humidity
    age: 0,                   // minutes since mixing
    impurities: 0.1           // % by weight
  })
  const canvasRef = useRef(null)
  const [metrics, setMetrics] = useState(null)
  const [wand, setWand] = useState([])
  const [t, setT] = useState(0)
  const animationRef = useRef(null)
  const debounceRef = useRef(null)

  // Memoize expensive calculations
  const memoizedMetrics = useMemo(() => {
    if (!wand.length) return null
    
    const R = params.Rcm / 100  // Convert cm to meters
    
    // Compute Weber number from wind speed
    const We = weberFromVelocity(params.U, R, params.sigma, params.rho)
    if (We === null) return null
    
    // Predict deformation using empirical surrogate law
    const D = deformationFromWeber(We)
    if (D === null) return null
    
    // Compute axis ratio from deformation
    const chi = (1 + D) / (1 - D)
    
    // Apply wand release effects (jerk creates additional stretching)
    const stretch = 1 + params.jerk
    const a = R * 100 * chi * stretch  // Convert back to pixels
    const b = R * 100 * (1 / stretch)
    
    // Compute relaxation time
    const tau = (params.muEff * R) / params.sigma
    
    return { 
      We, 
      chi, 
      D, 
      tau, 
      a, 
      b,
      relaxationTime: tau,
      weberNumber: We,
      deformation: D,
      axisRatio: chi
    }
  }, [params.U, params.jerk, params.Rcm, params.sigma, params.rho, params.muEff, wand.length])

  // Optimized animation loop
  useEffect(() => {
    const animate = () => {
      setT(prev => prev + 0.016)
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Memoized draw function
  const draw = useCallback(() => {
    const c = canvasRef.current
    if (!c || !memoizedMetrics) return
    
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)

    // Draw swaying wand and string
    const swayed = swayPoints(wand, params.U, t)
    drawWandAndString(ctx, swayed)

    // Compute wand mouth statistics
    const stats = computeMouthStats(swayed)

    // Draw predicted bubble shape
    const { a, b } = memoizedMetrics
    ctx.save()
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate(stats.angle)
    ctx.strokeStyle = '#3ad1c9'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    
    // Only update metrics when they change significantly to prevent excessive renders
    // Don't call setMetrics on every animation frame!
  }, [wand, params.U, t, memoizedMetrics])

  // Draw the wand and string with sway
  const drawWandAndString = useCallback((ctx, swayed) => {
    const wands = swayed.filter(p => p.type === 'wand1' || p.type === 'wand2')
    const stringPoints = swayed.filter(p => p.type === 'string')
    
    // Draw string loop
    if (stringPoints.length > 0) {
      ctx.strokeStyle = '#5b6bff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(stringPoints[0].x, stringPoints[0].y)
      for (let i = 1; i < stringPoints.length; i++) {
        ctx.lineTo(stringPoints[i].x, stringPoints[i].y)
      }
      // Close the loop
      ctx.lineTo(stringPoints[0].x, stringPoints[0].y)
      ctx.stroke()
    }
    
    // Draw wands
    wands.forEach(wand => {
      const length = 40
      const endX = wand.x + Math.cos(wand.angle || 0) * length
      const endY = wand.y + Math.sin(wand.angle || 0) * length
      
      ctx.strokeStyle = '#ff6b6b'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(wand.x, wand.y)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      
      // Wand handle
      ctx.fillStyle = '#ff6b6b'
      ctx.beginPath()
      ctx.arc(wand.x, wand.y, 6, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [])

  // Only redraw when necessary
  useEffect(() => {
    draw()
  }, [draw])

  // Update metrics only when memoizedMetrics change, not on every animation frame
  useEffect(() => {
    if (memoizedMetrics) {
      const stats = computeMouthStats(swayPoints(wand, params.U, t))
      setMetrics({ ...memoizedMetrics, mouth: stats })
    }
  }, [memoizedMetrics, wand, params.U, t])

  // Debounced parameter update
  const updateParam = useCallback((key, value) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      setParams(prev => ({ ...prev, [key]: value }))
    }, 16) // ~60fps debouncing
  }, [])

  const ui = useCallback((k, v) => updateParam(k, v), [updateParam])

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
      </div>

      <div className="card">
        <h4>🧼 Bubble Solution Properties</h4>
        <div className="controls" style={{ gap: 16 }}>
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
          <label className="pill" title="Air density (kg/m³)">
            ρ
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.1"
              value={params.rho}
              onChange={(e) => ui('rho', parseFloat(e.target.value))}
            />{' '}
            {params.rho.toFixed(1)} kg/m³
          </label>
          <label className="pill" title="Effective viscosity (Pa·s)">
            μ
            <input
              type="range"
              min="1e-6"
              max="5e-5"
              step="1e-6"
              value={params.muEff}
              onChange={(e) => ui('muEff', parseFloat(e.target.value))}
            />{' '}
            {(params.muEff * 1e6).toFixed(1)} μPa·s
          </label>
        </div>
        <div className="controls" style={{ gap: 16 }}>
          <label className="pill" title="Soap concentration (%)">
            🧴 Soap %
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={params.soapConcentration}
              onChange={(e) => ui('soapConcentration', parseFloat(e.target.value))}
            />{' '}
            {params.soapConcentration.toFixed(1)}%
          </label>
          <label className="pill" title="Temperature (°C)">
            🌡️ Temp
            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={params.temperature}
              onChange={(e) => ui('temperature', parseFloat(e.target.value))}
            />{' '}
            {params.temperature}°C
          </label>
          <label className="pill" title="Humidity (%)">
            💧 Humidity
            <input
              type="range"
              min="20"
              max="80"
              step="5"
              value={params.humidity}
              onChange={(e) => ui('humidity', parseFloat(e.target.value))}
            />{' '}
            {params.humidity}%
          </label>
        </div>
      </div>
      
      <div className="sim-wrap">
        <canvas ref={canvasRef} width={720} height={360}></canvas>
      </div>
      
      <WandEditor points={wand} onChange={setWand} />
      
      {metrics && (
        <div className="kv">
          <div className="label">Weber number (We)</div>
          <div>{metrics.weberNumber.toFixed(2)}</div>
          <div className="label">Deformation D</div>
          <div>{metrics.deformation.toFixed(3)}</div>
          <div className="label">Axis ratio χ</div>
          <div>{metrics.axisRatio.toFixed(2)}</div>
          <div className="label">Relaxation time τ</div>
          <div>{metrics.relaxationTime.toFixed(3)} s</div>
          <div className="label">Mouth angle</div>
          <div>{(metrics.mouth.angle * 180 / Math.PI).toFixed(1)}°</div>
          <div className="label">Predicted semi-axes</div>
          <div>a = {metrics.a.toFixed(1)} px, b = {metrics.b.toFixed(1)} px</div>
        </div>
      )}
    </div>
  )
})

export default Simulator

