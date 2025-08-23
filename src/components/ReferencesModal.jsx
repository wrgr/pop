import React from 'react'


export default function ReferencesModal({onClose}){
return (
<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={onClose}>
<div style={{background:'#fff',padding:'20px',borderRadius:'12px',maxWidth:'720px',maxHeight:'80%',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
<h3>Scientific References & Parameter Meanings</h3>
<p><b>Deformation parameter.</b> <code>D=(L−B)/(L+B)</code> using projected ellipse diameters; standard in the Taylor/Grace tradition for small‑to‑moderate deformations.</p>
<p><b>Weber number.</b> <code>We = ρ U² R / σ</code> compares inertial to capillary stresses.</p>
<p><b>Axis‑ratio ↔ We correlation (used here).</b> <code>χ(We)=1 + c1·We/(1 + c2·We)</code>, χ=a/b, with <code>c1</code> (slope) and <code>c2</code> (saturation). This captures the monotone trend summarized by Loth (2008) for bubbles/drops in uniform flow; you may replace it with a literature exact fit.</p>
<ul>
<li><b>c1, c2</b>: dimensionless shape‑sensitivity constants.</li>
<li><b>ρ</b> (air density): ~1.2 kg/m³ at sea level.</li>
<li><b>μ</b> (air viscosity): ~1.8×10⁻⁵ Pa·s.</li>
<li><b>σ</b> (surface tension): ~0.025–0.035 N/m typical for bubble mixes; higher → less deformation.</li>
<li><b>R</b>: effective radius; from image scale or a fallback constant.</li>
<li><b>g</b>: gravitational acceleration ~9.81 m/s².</li>
<li><b>τ</b> (relaxation time): ∝ μ_air·R/σ (capillary timescale) used in forward relaxation.</li>
</ul>
<hr/>
<h4>Primary citations</h4>
<ul>
<li>Loth, E. (2008). <i>Quasi‑steady shape and drag of deformable bubbles and drops.</i> Int. J. Multiphase Flow 34(6), 523‑546.</li>
<li>Taylor, G. I. (1934); Grace, H. P. (1971+). Classical deformation parameter & shear‑flow analyses.</li>
<li>Rao, R. et al. (2024). <i>Dynamics of soap bubble inflation.</i> Phys. Rev. Fluids 9:L051602.</li>
<li>Chatzigiannakis, E. et al. (2021). <i>Thin liquid films: a review.</i> Curr. Opin. Colloid Interface Sci. 56:101461.</li>
<li>White, F. M. (2011). <i>Fluid Mechanics</i> (7th ed.). (Air viscosity.)</li>
<li>NIST (2019). <i>CODATA recommended values of the fundamental constants</i>. (Standard gravity.)</li>
</ul>
<div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
<button className="btn" onClick={onClose}>Close</button>
</div>
</div>
</div>
)
}
