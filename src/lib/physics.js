// Lightweight forward model: ellipsoid evolves under wind forcing (via We)
// and relaxes toward a sphere. The original file was accidentally truncated
// leaving the statements below at top level and causing a SyntaxError. The
// dynamics are now wrapped in an exported function `step` so callers can
// advance the bubble state safely.

import { deformationD } from './inference.js'

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
// PCA for orientation
const n=points.length
const cx = points.reduce((s,p)=>s+p.x,0)/n
const cy = points.reduce((s,p)=>s+p.y,0)/n
let sxx=0, syy=0, sxy=0
for(const p of points){ const x=p.x-cx, y=p.y-cy; sxx+=x*x; syy+=y*y; sxy+=x*y }
const tr = sxx+syy, det = sxx*syy - sxy*sxy
const tmp = Math.sqrt(Math.max(0, tr*tr/4 - det))
const l1 = tr/2 + tmp
const v1x = sxy!==0 ? l1 - syy : 1
const v1y = sxy!==0 ? sxy : 0
const angle = Math.atan2(v1y, v1x)
// bounds
let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity
for(const p of points){ minx=Math.min(minx,p.x); maxx=Math.max(maxx,p.x); miny=Math.min(miny,p.y); maxy=Math.max(maxy,p.y) }
const width = maxx-minx, height = maxy-miny
return { angle, width, height, center:{x:cx,y:cy} }
}


export function swayPoints(points, U, t){
const A = U*2 // pixels amplitude
const w = 2*Math.PI*0.6 // Hz
return points.map((p,i)=> ({ x: p.x + A*Math.sin(w*t + i*0.3), y: p.y + 0.2*A*Math.cos(w*t + i*0.2) }))
}