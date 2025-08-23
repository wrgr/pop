import React, { useEffect, useState } from 'react'

// Exposes χ(We) and We parameters to the UI and publishes to window.POP_PARAMS
export default function CorrelationPanel() {
  const [c1, setC1] = useState(0.9)
  const [c2, setC2] = useState(0.35)
  const [rho, setRho] = useState(1.2) // kg/m^3
  const [sigma, setSigma] = useState(0.03) // N/m
  const [Rf, setRf] = useState(0.2) // m fallback radius
  const [mu, setMu] = useState(1.8e-5) // Pa·s air viscosity
  const [muFilm, setMuFilm] = useState(0.001) // Pa·s film viscosity

  useEffect(() => {
    window.POP_PARAMS = { c1, c2, rho, sigma, Rf, mu, muFilm }
  }, [c1, c2, rho, sigma, Rf, mu, muFilm])

  return (
    <div className="stack">
      <div className="controls" style={{ gap: 12 }}>
        <label
          className="pill"
          title="Slope of χ vs We; higher yields more deformation"
        >
          c₁
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.01"
            value={c1}
            onChange={(e) => setC1(parseFloat(e.target.value))}
          />
          {c1.toFixed(2)}
        </label>
        <label
          className="pill"
          title="Saturation constant; higher flattens χ at large We"
        >
          c₂
          <input
            type="range"
            min="0.05"
            max="1.5"
            step="0.01"
            value={c2}
            onChange={(e) => setC2(parseFloat(e.target.value))}
          />
          {c2.toFixed(2)}
        </label>
        <label className="pill" title="Air density (kg/m³)">
          ρ
          <input
            type="range"
            min="0.8"
            max="1.4"
            step="0.01"
            value={rho}
            onChange={(e) => setRho(parseFloat(e.target.value))}
          />
          {rho.toFixed(2)} kg/m³
        </label>
        <label className="pill" title="Surface tension; higher → less deformation">
          σ
          <input
            type="range"
            min="0.015"
            max="0.05"
            step="0.001"
            value={sigma}
            onChange={(e) => setSigma(parseFloat(e.target.value))}
          />
          {sigma.toFixed(3)} N/m
        </label>
        <label className="pill" title="Dynamic viscosity of air (Pa·s)">
          μ<sub>air</sub>
          <input
            type="range"
            min="0.00001"
            max="0.00005"
            step="0.000001"
            value={mu}
            onChange={(e) => setMu(parseFloat(e.target.value))}
          />
          {mu.toExponential(1)} Pa·s
        </label>
        <label className="pill" title="Dynamic viscosity of bubble film (Pa·s)">
          μ<sub>film</sub>
          <input
            type="range"
            min="0.0005"
            max="0.005"
            step="0.0001"
            value={muFilm}
            onChange={(e) => setMuFilm(parseFloat(e.target.value))}
          />
          {muFilm.toFixed(4)} Pa·s
        </label>
        <label className="pill" title="Fallback bubble radius if scale not set (m)">
          R₀
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.005"
            value={Rf}
            onChange={(e) => setRf(parseFloat(e.target.value))}
          />
          {Math.round(Rf * 100)} cm
        </label>
      </div>
      <div className="notice small">
        <div className="eq">χ(We) = 1 + c₁·We/(1 + c₂·We)</div>
        <div className="eq">We = ρ U² R / σ</div>
        <div className="eq">τ ≈ μ<sub>air</sub>·R/σ</div>
        χ is the projected axis ratio <code>a/b</code>. Increase <b>c₁</b> for stronger
        deformation at a given We; increase <b>c₂</b> for faster saturation.
      </div>
    </div>
  )
}

