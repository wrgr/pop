import React, { useState } from 'react'
import Analyzer from './components/Analyzer.jsx'
import Simulator from './components/Simulator.jsx'
import ReferencesModal from './components/ReferencesModal.jsx'
import CorrelationPanel from './components/CorrelationPanel.jsx'

export default function App() {
  const [refsOpen, setRefsOpen] = useState(false)
  return (
    <>
      <header>
        <div className="wrap title">
          <div className="bubble" aria-hidden="true" />
          <div>
            <h1>POP — Phil's Orb Playground</h1>
            <div className="subtitle">
              If you were able to accurately model shape of the bubble, could you
              predict how the wind was blowing or the wands were held during
              bubble launch?
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="grid">
          <section className="card">
            <h2>1) Inverse: Photo/Video → Wind & Wand</h2>
            <div className="body">
              <Analyzer />
            </div>
          </section>
          <section className="card">
            <h2>2) Forward: Wind & Wand → Bubble</h2>
            <div className="body">
              <Simulator />
            </div>
          </section>
          <section className="card">
            <h2>3) Model parameters (χ ↔ We ↔ U)</h2>
            <div className="body">
              <CorrelationPanel />
              <div className="footer small">
                These constants feed the axis‑ratio → Weber and Weber → wind
                mapping used by POP. Adjust them to match your calibration.
                Click
                <button className="btn" onClick={() => setRefsOpen(true)}>
                  References
                </button>
                for the formulas and citations.
              </div>
            </div>
          </section>
          <section className="card">
            <h2>About & Citations</h2>
            <div className="body small">
              <p>
                POP uses literature‑inspired heuristics: ellipse deformation ↔
                Weber number, capillary/relaxation scaling, and launch
                elongation from wand jerk. It’s a teaching tool — not a
                metrology instrument — but can be locally calibrated.
              </p>
              <ul>
                <li>
                  Deformation parameter <code>D=(L-B)/(L+B)</code> (Taylor/Grace
                  tradition).
                </li>
                <li>
                  Axis ratio ↔ Weber number, shape/drag correlations (Loth,
                  2008).
                </li>
                <li>Inflation/detachment context (Rao et al., 2024).</li>
                <li>Thin‑film drainage scaling (thin‑film reviews).</li>
              </ul>
              <button className="btn" onClick={() => setRefsOpen(true)}>
                📚 References
              </button>
            </div>
          </section>
        </div>
      </main>
      {refsOpen && <ReferencesModal onClose={() => setRefsOpen(false)} />}
    </>
  )
}

