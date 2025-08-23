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


export function mapAxisRatioToU(axisRatio, Rm){
const { c1, c2, rho, sigma, Rf } = params()
const chi = Math.max(1.0, axisRatio)
// Invert chi(We) = 1 + c1*We/(1+c2*We) → We = (chi-1)/(c1 - c2*(chi-1))
const y = chi-1
const denom = (c1 - c2*y)
const We = y>0 && denom>1e-9 ? (y)/(denom) : 0
const R = Rm ?? Rf
const U = Math.sqrt(Math.max(0, We * sigma / (rho * R)))
const Ulo = Math.max(0, U*0.7), Uhi = U*1.3 // crude ±30% band (user can calibrate)
const cls = U<0.5? 'Calm' : U<2? 'Light breeze' : U<4? 'Moderate' : 'Gusty'
return { U, Ulo, Uhi, cls, We }
}

export function mapUToAxisRatio(U, Rm){
const { c1, c2, rho, sigma, Rf } = params()
const R = Rm ?? Rf
const We = rho * U * U * R / sigma
const chi = 1 + (c1 * We) / (1 + c2 * We)
return chi
}
