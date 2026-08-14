import React, { useState, useCallback } from 'react'
import Analyzer from './components/Analyzer.jsx'
import BubblePhysics from './components/BubblePhysics.jsx'
import ReferencesModal from './components/ReferencesModal.jsx'
import CorrelationPanel from './components/CorrelationPanel.jsx'
import Card from './components/Card.jsx'
import Drawer from './components/Drawer.jsx'
import SimplePerformanceMonitor from './components/SimplePerformanceMonitor.jsx'
import logo from './images/logo.jpg'

// Citations, rendered as collapsible drawers so the page stays short.
const REFERENCES = [
  {
    title: '🎯 Loth (2008) — the empirical surrogate law',
    who: 'Loth, E. (2008). Quasi-steady shape and drag of deformable bubbles and drops. Progress in Energy and Combustion Science, 34(5), 423–455.',
    url: 'https://doi.org/10.1016/j.pecs.2008.01.002',
    summary:
      'Provides D ≈ k₁We/(1 + k₂We), linking bubble deformation to flow conditions (k₁ ≈ 0.24, k₂ ≈ 0.75 from experiment). This is the core equation behind POP’s inverse analysis.',
  },
  {
    title: '🏗️ Taylor (1932) — the deformation parameter',
    who: 'Taylor, G. I. (1932). The viscosity of a fluid containing small drops of another fluid. Proc. Royal Society A, 138, 41–48.',
    url: 'https://doi.org/10.1098/rspa.1932.0169',
    summary:
      'Established D = (a-b)/(a+b), the standard measure of drop/bubble elongation POP reads off every shape.',
  },
  {
    title: '📚 Clift, Grace & Weber (1978) — bubble dynamics',
    who: 'Clift, R., Grace, J. R., & Weber, M. E. (1978). Bubbles, Drops, and Particles. Academic Press.',
    url: 'https://www.elsevier.com/books/bubbles-drops-and-particles/clift/978-0-12-176950-5',
    summary:
      'The comprehensive reference on shape deformation, drag and dimensionless groups — the theoretical backdrop for why bubbles deform in wind.',
  },
  {
    title: '🔄 Rallison (1984) — viscous drops in shear',
    who: 'Rallison, J. M. (1984). The deformation of small viscous drops and bubbles in shear flows. Annu. Rev. Fluid Mech., 16, 45–66.',
    url: 'https://doi.org/10.1146/annurev.fl.16.010184.000401',
    summary:
      'Explains the time-dependent response POP models as the relaxation time τ — why a bubble does not snap instantly to a new wind.',
  },
  {
    title: '🧼 Rao et al. (2024) — soap bubble inflation',
    who: 'Rao, R. et al. (2024). Dynamics of soap bubble inflation. Physical Review Fluids, 9, L051602.',
    url: 'https://doi.org/10.1103/PhysRevFluids.9.L051602',
    summary:
      'Studies detachment and initial shape formation — the physics behind the launcher imprint (how the wand shapes a newborn bubble).',
  },
  {
    title: '💧 Chatzigiannakis et al. (2021) — thin liquid films',
    who: 'Chatzigiannakis, E. et al. (2021). Thin liquid films: a review. Curr. Opin. Colloid Interface Sci., 56, 101461.',
    url: 'https://doi.org/10.1016/j.cocis.2021.101461',
    summary:
      'Covers drainage, stability and rupture of bubble walls — why some bubbles pop and others survive, setting the analysis window.',
  },
  {
    title: '📊 Lide (2004) — air properties',
    who: 'Lide, D. R. (2004). CRC Handbook of Chemistry and Physics. CRC Press.',
    url: 'https://www.routledge.com/CRC-Handbook-of-Chemistry-and-Physics-85th-Edition/Lide/p/book/9780849304859',
    summary:
      'Supplies the physical constants (air density ρ ≈ 1.2 kg/m³, viscosity μ ≈ 1.8×10⁻⁵ Pa·s) POP’s calculations use.',
  },
]

export default function App() {
  const [refsOpen, setRefsOpen] = useState(false)

  const openRefs = useCallback(() => setRefsOpen(true), [])
  const closeRefs = useCallback(() => setRefsOpen(false), [])

  return (
    <>
      {process.env.NODE_ENV === 'development' && <SimplePerformanceMonitor />}
      <header>
        <div className="wrap title">
          <img src={logo} alt="POP logo" className="logo" />
          <div>
            <h1>POP — Phil's Orb Playground</h1>
            <div className="subtitle">
              If you could accurately model the shape of a bubble, could you predict
              how the wind was blowing — or how the wands were held — during launch?
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="grid">
          <Card className="span-2" title="🫧 Live Physics: watch a bubble deform in the wind">
            <BubblePhysics />
          </Card>

          <Card title="🔍 Inverse: Photo / Video → Wind & Wand">
            <Analyzer />
          </Card>

          <Card title="⚙️ Model parameters (χ ↔ We ↔ U)">
            <CorrelationPanel />
            <div className="footer small">
              These constants feed the axis‑ratio → Weber and Weber → wind
              mapping. Adjust them to match your own calibration.
            </div>
          </Card>

          <Card title="ℹ️ About POP">
            <div className="stack">
              <p>
                POP answers one question — <strong>can a bubble's shape reveal the wind and how the
                wand was held?</strong> — by simulating it both ways. The <strong>Live Physics</strong>{' '}
                panel runs a real soft-body soap film (surface tension, internal pressure, an
                aerodynamic wind, gravity sag, spin and a choice of launcher), measures the emergent
                shape, and infers the conditions back from it — including from a whole recorded series.
              </p>
              <p><strong>What you can do here:</strong></p>
              <ul>
                <li><strong>Live Physics:</strong> play the forward model, then hit <em>Record &amp; analyze</em> to run it in reverse.</li>
                <li><strong>Analyzer:</strong> fit an ellipse to a real photo or video and read out wind &amp; wand.</li>
                <li><strong>Custom loop:</strong> design your own wand in Live Physics — its shape becomes the bubble's.</li>
              </ul>
              <p className="small">
                POP is a teaching tool built on literature‑inspired heuristics (deformation ↔ Weber
                number, capillary/relaxation scaling) — not a metrology instrument — but it can be
                locally calibrated.
              </p>
              <button className="btn" onClick={openRefs}>📖 How-to guide</button>
            </div>
          </Card>

          <Card className="span-2" title="📚 Scientific References & Citations">
            <p className="small" style={{ marginTop: 0 }}>
              The literature POP's heuristics are built on. Expand any entry for a plain-English
              summary and the paper link.
            </p>
            {REFERENCES.map((r) => (
              <Drawer key={r.url} title={r.title}>
                <div className="stack small">
                  <p style={{ margin: 0 }}>{r.who}</p>
                  <p style={{ margin: 0 }}>{r.summary}</p>
                  <a href={r.url} target="_blank" rel="noopener" className="btn small" style={{ alignSelf: 'flex-start' }}>
                    🔗 View source
                  </a>
                </div>
              </Drawer>
            ))}
          </Card>
        </div>
      </main>
      {refsOpen && <ReferencesModal onClose={closeRefs} />}
    </>
  )
}
