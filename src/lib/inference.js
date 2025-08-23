// Deformation parameter D and mapping to Weber number / wind speed
// D = (L - B) / (L + B) with L=major diameter, B=minor diameter
export const deformationD = (a,b)=> ((2*a)-(2*b))/((2*a)+(2*b))


// Axis-ratio (χ=a/b) → Weber → wind speed U, with exposed parameters
function params(){
const p = (typeof window!=='undefined' && window.POP_PARAMS) || {}
return {
c1: p.c1 ?? 0.9,
c2: p.c2 ?? 0.35,
rho: p.rho ?? 1.20, // kg/m^3
sigma: p.sigma ?? 0.03, // N/m
Rf: p.Rf ?? 0.20 // m
}
}


/**
 * Convert axis ratio to wind speed using an analytic inversion of the
 * χ(We) surrogate. Also returns inferred semi-axes assuming constant volume.
 * @param {number} axisRatio - Observed χ=a/b (>=1)
 * @param {number} Rm        - Mean bubble radius (m)
 * @returns {{U:number,Ulo:number,Uhi:number,cls:string,We:number,chi:number,a:number,b:number}}
 */
export function mapAxisRatioToU(axisRatio, Rm){
  const { c1, c2, rho, sigma, Rf } = params()
  const chi = Math.max(1.0, axisRatio)
  // Invert χ(We) = 1 + c1·We/(1 + c2·We)
  const y = chi - 1
  const denom = (c1 - c2*y)
  const We = y>0 && denom>1e-9 ? y/denom : 0
  const R = Rm ?? Rf
  const U = Math.sqrt(Math.max(0, We * sigma / (rho * R)))
  const Ulo = Math.max(0, U*0.7), Uhi = U*1.3 // crude ±30% band (user can calibrate)
  const cls = U<0.5? 'Calm' : U<2? 'Light breeze' : U<4? 'Moderate' : 'Gusty'
  const {a,b} = axesFromAxisRatio(chi, R)
  return { U, Ulo, Uhi, cls, We, chi, a, b }
}

/**
 * Forward surrogate: wind speed to axis ratio and semi-axes.
 * @param {number} U   - Wind speed (m/s)
 * @param {number} Rm  - Mean bubble radius (m)
 * @returns {{chi:number,a:number,b:number,We:number}}
 */
export function mapUToAxisRatio(U, Rm){
  const { c1, c2, rho, sigma, Rf } = params()
  const R = Rm ?? Rf
  const We = rho * U * U * R / sigma
  const chi = 1 + (c1 * We) / (1 + c2 * We)
  const {a,b} = axesFromAxisRatio(chi, R)
  return { chi, a, b, We }
}

/**
 * Given an axis ratio χ and mean radius, return consistent semi-axes assuming
 * volume conservation (a·b² = R³).
 * @param {number} chi
 * @param {number} R
 * @returns {{a:number,b:number}}
 */
export function axesFromAxisRatio(chi, R){
  const a = R * Math.pow(chi, 2/3)
  const b = R / Math.pow(chi, 1/3)
  return { a, b }
}

/**
 * Inverse of axesFromAxisRatio.
 * @param {number} a
 * @param {number} b
 * @returns {number} axis ratio χ=a/b
 */
export function axisRatioFromAxes(a,b){
  return Math.max(1e-9, a/b)
}
