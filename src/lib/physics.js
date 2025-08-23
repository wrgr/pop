// Lightweight forward model: ellipsoid evolves under wind forcing (via We)
// and relaxes toward a sphere. The original file was accidentally truncated
// leaving the statements below at top level and causing a SyntaxError. The
// dynamics are now wrapped in an exported function `step` so callers can
// advance the bubble state safely.

import { deformationD } from './inference.js'

// Cache for expensive calculations
const calculationCache = new Map()

/**
 * Advance the bubble state by a timestep.
 * @param {object} state - Current state {a,b,x,y} in pixels.
 * @param {number} dt    - Timestep in seconds.
 * @param {object} cal   - Calibration/forcing terms.
 *   Requires {U, dir, aTarget, bTarget, R, tau, shearGain}.
 */
export function step(state, dt, cal){
  const { U=0, dir=0, aTarget=state.a, bTarget=state.b, R=state.a, tau=0.1, shearGain=1 } = cal

  // relax (a,b) toward targets with tau, plus relax toward sphere when U small
  const g = shearGain
  const a = state.a + ((aTarget - state.a) * g) * dt / tau + (R - state.a) * (1 - g) * dt / tau
  const b = state.b + ((bTarget - state.b) * g) * dt / tau + (R - state.b) * (1 - g) * dt / tau

  // move bubble with wind (simple drift)
  const speedPx = U * 40 // scale for demo
  const ang = dir * Math.PI / 180
  const x = (state.x ?? 100) + Math.cos(ang) * speedPx * dt
  const y = (state.y ?? 200) - Math.sin(ang) * speedPx * dt

  const axisRatio = Math.max(1e-6, a / b)
  const D = deformationD(a, b)
  const next = { a, b, ang, x, y }
  const metrics = { axisRatio, D }
  return { state: next, metrics }
}


export function adviceFromParams(p){
  const msgs=[]
  if(p.U>4) msgs.push('Try lower wind or turn 20° into wind to reduce elongation.')
  if(p.jerk>0.6) msgs.push('Reduce jerk at detachment to avoid necking.')
  if(p.Rcm<20) msgs.push('Use larger loop or higher cohesion (σ) to grow radius.')
  return msgs.length? msgs.join(' ') : 'Looks good — steady pull should work.'
}


// ---- Wand utilities ----
export function computeMouthStats(points){
  if(!points || points.length<2) return { angle:0, width:0, height:0 }
  
  // Create cache key for this set of points
  const cacheKey = points.map(p => `${p.x},${p.y}`).join('|')
  if (calculationCache.has(cacheKey)) {
    return calculationCache.get(cacheKey)
  }
  
  // For wand analysis, focus on string points (not wand handles)
  const stringPoints = points.filter(p => p.type === 'string')
  if (stringPoints.length < 2) {
    return { angle: 0, width: 0, height: 0, center: { x: 0, y: 0 } }
  }
  
  // PCA for orientation of the string loop
  const n = stringPoints.length
  const cx = stringPoints.reduce((s,p)=>s+p.x,0)/n
  const cy = stringPoints.reduce((s,p)=>s+p.y,0)/n
  let sxx=0, syy=0, sxy=0
  for(const p of stringPoints){ const x=p.x-cx, y=p.y-cy; sxx+=x*x; syy+=y*y; sxy+=x*y }
  const tr = sxx+syy, det = sxx*syy - sxy*sxy
  const tmp = Math.sqrt(Math.max(0, tr*tr/4 - det))
  const l1 = tr/2 + tmp
  const v1x = sxy!==0 ? l1 - syy : 1
  const v1y = sxy!==0 ? sxy : 0
  const angle = Math.atan2(v1y, v1x)
  
  // bounds of the string loop
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity
  for(const p of stringPoints){ minx=Math.min(minx,p.x); maxx=Math.max(maxx,p.x); miny=Math.min(miny,p.y); maxy=Math.max(maxy,p.y) }
  const width = maxx-minx, height = maxy-miny
  
  const result = { angle, width, height, center:{x:cx,y:cy} }
  
  // Cache the result (limit cache size to prevent memory issues)
  if (calculationCache.size > 100) {
    const firstKey = calculationCache.keys().next().value
    calculationCache.delete(firstKey)
  }
  calculationCache.set(cacheKey, result)
  
  return result
}


export function swayPoints(points, U, t){
  // Cache sway calculations for common parameters
  const cacheKey = `${U},${t},${points.length}`
  if (calculationCache.has(cacheKey)) {
    return calculationCache.get(cacheKey)
  }
  
  const A = U*2 // pixels amplitude
  const w = 2*Math.PI*0.6 // Hz
  
  const result = points.map((p, i) => {
    let swayX = 0, swayY = 0
    
    if (p.type === 'string') {
      // String points sway more in the wind
      swayX = A * Math.sin(w*t + i*0.3)
      swayY = 0.2 * A * Math.cos(w*t + i*0.2)
    } else if (p.type === 'wand1' || p.type === 'wand2') {
      // Wand handles sway less (they're held)
      swayX = 0.1 * A * Math.sin(w*t + i*0.1)
      swayY = 0.05 * A * Math.cos(w*t + i*0.1)
    }
    
    return { 
      ...p,
      x: p.x + swayX, 
      y: p.y + swayY 
    }
  })
  
  // Cache the result
  calculationCache.set(cacheKey, result)
  
  return result
}

/**
 * Calculate the area of the string loop for bubble size estimation
 */
export function calculateLoopArea(points) {
  const stringPoints = points.filter(p => p.type === 'string')
  if (stringPoints.length < 3) return 0
  
  // Use shoelace formula for polygon area
  let area = 0
  for (let i = 0; i < stringPoints.length; i++) {
    const j = (i + 1) % stringPoints.length
    area += stringPoints[i].x * stringPoints[j].y
    area -= stringPoints[j].x * stringPoints[i].y
  }
  
  return Math.abs(area) / 2
}

/**
 * Estimate bubble radius from loop area
 */
export function estimateBubbleRadiusFromLoop(points) {
  const area = calculateLoopArea(points)
  // Assume circular bubble: A = πr², so r = √(A/π)
  return Math.sqrt(area / Math.PI)
}

/**
 * Calculate wand separation and orientation
 */
export function calculateWandGeometry(points) {
  const wands = points.filter(p => p.type === 'wand1' || p.type === 'wand2')
  if (wands.length !== 2) return null
  
  const [wand1, wand2] = wands
  const separation = Math.hypot(wand2.x - wand1.x, wand2.y - wand1.y)
  const angle = Math.atan2(wand2.y - wand1.y, wand2.x - wand1.x)
  
  return {
    separation,
    angle,
    center: {
      x: (wand1.x + wand2.x) / 2,
      y: (wand1.y + wand2.y) / 2
    }
  }
}