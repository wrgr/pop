import React, { useEffect, useState } from 'react'


// Exposes χ(We) and We parameters to the UI and publishes to window.POP_PARAMS
export default function CorrelationPanel(){
const [c1,setC1]=useState(0.9)
const [c2,setC2]=useState(0.35)
const [rho,setRho]=useState(1.20) // kg/m^3
const [mu,setMu]=useState(1.8e-5) // Pa·s dynamic viscosity
const [sigma,setSigma]=useState(0.03) // N/m
const [Rf,setRf]=useState(0.20) // meters fallback when no scale
const [g,setG]=useState(9.81) // m/s^2


useEffect(()=>{ window.POP_PARAMS = { c1,c2,rho,mu,sigma,Rf,g } },[c1,c2,rho,mu,sigma,Rf,g])


return (
<div className="stack">
<div className="controls" style={{gap:12}}>
<label className="pill">c1 <input type="range" min="0.2" max="2.0" step="0.01" value={c1} onChange={e=>setC1(parseFloat(e.target.value))}/> {c1.toFixed(2)}</label>
<label className="pill">c2 <input type="range" min="0.05" max="1.5" step="0.01" value={c2} onChange={e=>setC2(parseFloat(e.target.value))}/> {c2.toFixed(2)}</label>
<label className="pill">ρ air <input type="range" min="0.8" max="1.4" step="0.01" value={rho} onChange={e=>setRho(parseFloat(e.target.value))}/> {rho.toFixed(2)} kg/m³</label>
<label className="pill">μ air <input type="range" min="0.00001" max="0.00005" step="0.000001" value={mu} onChange={e=>setMu(parseFloat(e.target.value))}/> {mu.toExponential(2)} Pa·s</label>
<label className="pill">σ film <input type="range" min="0.015" max="0.05" step="0.001" value={sigma} onChange={e=>setSigma(parseFloat(e.target.value))}/> {sigma.toFixed(3)} N/m</label>
<label className="pill">R fallback <input type="range" min="0.05" max="0.5" step="0.005" value={Rf} onChange={e=>setRf(parseFloat(e.target.value))}/> {Math.round(Rf*100)} cm</label>
<label className="pill">g <input type="range" min="9.5" max="10.5" step="0.01" value={g} onChange={e=>setG(parseFloat(e.target.value))}/> {g.toFixed(2)} m/s²</label>
</div>
<div className="notice small">
Mapping: <code>χ(We) = 1 + c1·We/(1 + c2·We)</code>, and <code>We = ρ U² R / σ</code>.
χ is the projected axis ratio <code>a/b</code>. Increase <b>c1</b> for stronger deformation at a given We; increase <b>c2</b> for faster saturation.
</div>
</div>
)
}
