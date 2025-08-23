import React, { useState, useCallback } from 'react'
import Analyzer from './components/Analyzer.jsx'
import Simulator from './components/Simulator.jsx'
import ReferencesModal from './components/ReferencesModal.jsx'
import CorrelationPanel from './components/CorrelationPanel.jsx'
import Card from './components/Card.jsx'
import SimplePerformanceMonitor from './components/SimplePerformanceMonitor.jsx'
import ScientificDemo from './components/ScientificDemo.jsx'
import logo from './images/logo.jpg'

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
              If you were able to accurately model shape of the bubble, could you
              predict how the wind was blowing or the wands were held during
              bubble launch?
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="grid">
          <Card title="1) Inverse: Photo/Video → Wind & Wand">
            <Analyzer />
          </Card>
          <Card title="2) Forward: Wind & Wand → Bubble">
            <Simulator />
          </Card>
          <Card title="3) Model parameters (χ ↔ We ↔ U)">
            <CorrelationPanel />
            <div className="footer small">
              These constants feed the axis‑ratio → Weber and Weber → wind
              mapping used by POP. Adjust them to match your calibration.
              See the "How to Use" section above for detailed guidance.
            </div>
          </Card>
          {/* Core Question & Key Insights */}
          <Card title="🎯 Core Question & Key Insights">
            <div className="stack">
              <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ color: 'white', margin: '0 0 16px 0' }}>Can Bubble Shape Predict Wind & Wand Motion?</h3>
                <div style={{ fontSize: '16px', lineHeight: '1.6' }}>
                  <p><strong>Answer: YES, with sophisticated physics modeling!</strong></p>
                  <p>The key insight is the empirical surrogate law D ≈ k₁We/(1 + k₂We) that links observable bubble deformation to underlying flow physics, enabling bidirectional inference with physical validation.</p>
                </div>
              </div>
              
              <div className="card">
                <h4>🔬 What We Can Extract:</h4>
                <ul>
                  <li><strong>Wind Speed:</strong> From bubble elongation (Weber number)</li>
                  <li><strong>Wind Direction:</strong> From major axis orientation</li>
                  <li><strong>Wand Motion:</strong> From video analysis (least-squares fitting)</li>
                  <li><strong>Confidence:</strong> Quantified uncertainty assessment</li>
                </ul>
              </div>
              
              <div className="card">
                <h4>🧪 How It Works:</h4>
                <ul>
                  <li><strong>Single Photo:</strong> Use empirical surrogate laws to map deformation to Weber number</li>
                  <li><strong>Video Analysis:</strong> Separate wand release motion from ambient wind using least-squares fitting</li>
                  <li><strong>Physics Validation:</strong> All results are constrained by known fluid mechanics relationships</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* How to Use & Scientific Foundation */}
          <Card title="📚 How to Use POP">
            <div className="stack">
              <p>
                POP demonstrates the power of physics-based modeling to answer the core question: 
                <strong> "Can bubble shape predict wind and wand motion?"</strong>
              </p>
              <p>
                <strong>Key Components:</strong>
              </p>
              <ul>
                <li><strong>Analyzer:</strong> Upload photos/videos to analyze real bubbles</li>
                <li><strong>Simulator:</strong> Explore wind-wand-bubble relationships</li>
                <li><strong>Wand Editor:</strong> Design custom wand configurations</li>
              </ul>
              <button className="btn" onClick={openRefs}>📖 Detailed How-to Guide</button>
            </div>
          </Card>

          {/* Scientific Demo */}
          <Card title="4) Scientific Foundation">
            <ScientificDemo />
          </Card>
          <Card title="About & Citations" bodyClassName="small">
            <p>
              POP uses literature‑inspired heuristics: ellipse deformation ↔
              Weber number, capillary/relaxation scaling, and launch
              elongation from wand jerk. It's a teaching tool — not a
              metrology instrument — but can be locally calibrated.
            </p>
            <p>
              POP demonstrates the power of physics-based modeling for inverse problems in fluid mechanics. 
              By combining empirical surrogate laws with dynamic relaxation modeling, it can extract 
              wind and wand motion information from bubble shapes with quantified uncertainty.
            </p>
            <a className="btn" href="help.html" target="_blank" rel="noopener">
              ℹ️ Help
            </a>
          </Card>
          
          {/* Comprehensive References Section */}
          <Card title="📚 Scientific References & Citations">
            <div className="stack">
              <div className="card">
                <h4>🎯 Core Physics: Bubble Deformation & Flow</h4>
                <div className="kv small">
                  <div className="label">Primary Reference</div>
                  <div>
                    <strong>Loth, E. (2008).</strong> Quasi-steady shape and drag of deformable bubbles and drops. 
                    <em>Progress in Energy and Combustion Science</em>, 34(5), 423–455.
                    <br/>
                    <a href="https://doi.org/10.1016/j.pecs.2008.01.002" target="_blank" rel="noopener" className="btn small">
                      🔗 View Paper
                    </a>
                  </div>
                  <div className="label">Plain English Summary</div>
                  <div>
                    This paper provides the empirical surrogate law D ≈ k₁We/(1 + k₂We) that links 
                    bubble deformation to flow conditions. It's the foundation of POP's ability to 
                    infer wind from bubble shape. The constants k₁ ≈ 0.24 and k₂ ≈ 0.75 are 
                    calibrated from experimental data on bubble deformation in uniform flows.
                  </div>
                  <div className="label">How It Supports POP</div>
                  <div>
                    <strong>Provides the empirical surrogate law</strong> that enables bidirectional 
                    inference between bubble shape and wind conditions. This is the core equation 
                    that makes POP's inverse analysis possible.
                  </div>
                </div>
              </div>

              <div className="card">
                <h4>🏗️ Foundation: Classical Deformation Theory</h4>
                <div className="kv small">
                  <div className="label">Taylor, G. I. (1932)</div>
                  <div>
                    The viscosity of a fluid containing small drops of another fluid. 
                    <em>Proceedings of the Royal Society A</em>, 138, 41–48.
                    <br/>
                    <a href="https://doi.org/10.1098/rspa.1932.0169" target="_blank" rel="noopener" className="btn small">
                      🔗 View Paper
                    </a>
                  </div>
                  <div className="label">Plain English Summary</div>
                  <div>
                    Taylor's foundational work established the deformation parameter D = (a-b)/(a+b) 
                    for analyzing drop and bubble shapes in shear flows. This parameter is now 
                    standard in fluid mechanics and provides the mathematical framework for 
                    quantifying bubble elongation.
                  </div>
                  <div className="label">How It Supports POP</div>
                  <div>
                    <strong>Establishes the deformation parameter D</strong> that quantifies 
                    bubble elongation in a physically meaningful way. This is the fundamental 
                    measurement that POP uses to analyze bubble shapes.
                  </div>
                </div>
              </div>

              <div className="card">
                <h4>📚 Comprehensive Reference: Bubble Dynamics</h4>
                <div className="kv small">
                  <div className="label">Clift, R., Grace, J. R., & Weber, M. E. (1978)</div>
                  <div>
                    <em>Bubbles, Drops, and Particles</em>. Academic Press.
                    <br/>
                    <a href="https://www.elsevier.com/books/bubbles-drops-and-particles/clift/978-0-12-176950-5" target="_blank" rel="noopener" className="btn small">
                      🔗 View Book
                    </a>
                  </div>
                  <div className="label">Plain English Summary</div>
                  <div>
                    This comprehensive textbook covers all aspects of bubble and drop behavior, 
                    including shape deformation, drag forces, and dimensionless groups. It provides 
                    the theoretical background for understanding why bubbles deform in wind and 
                    how to model their behavior.
                  </div>
                  <div className="label">How It Supports POP</div>
                  <div>
                    <strong>Gives the theoretical foundation</strong> for understanding bubble 
                    dynamics and dimensionless groups. It provides the background knowledge needed 
                    to understand why bubbles deform in wind and how to model their behavior.
                  </div>
                </div>
              </div>

              <div className="card">
                <h4>🔄 Viscous Deformation: Shear Flow Analysis</h4>
                <div className="kv small">
                  <div className="label">Rallison, J. M. (1984)</div>
                  <div>
                    The deformation of small viscous drops and bubbles in shear flows. 
                    <em>Annual Review of Fluid Mechanics</em>, 16, 45–66.
                    <br/>
                    <a href="https://doi.org/10.1146/annurev.fl.16.010184.000401" target="_blank" rel="noopener" className="btn small">
                      🔗 View Paper
                    </a>
                  </div>
                  <div className="label">Plain English Summary</div>
                  <div>
                    Rallison's review explains how viscosity affects bubble deformation in 
                    flowing fluids. This is crucial for understanding why bubbles don't 
                    instantly respond to wind changes but instead relax over time, which 
                    POP models with the relaxation time τ.
                  </div>
                  <div className="label">How It Supports POP</div>
                  <div>
                    <strong>Explains the time-dependent behavior</strong> that POP models with 
                    relaxation dynamics. It helps understand why bubbles don't instantly respond 
                    to wind changes but relax over time.
                  </div>
                </div>
              </div>

              <div className="card">
                <h4>🧼 Soap Film Physics: Recent Advances</h4>
                <div className="kv small">
                  <div className="label">Rao, R. et al. (2024)</div>
                  <div>
                    Dynamics of soap bubble inflation. 
                    <em>Physical Review Fluids</em>, 9, L051602.
                    <br/>
                    <a href="https://doi.org/10.1103/PhysRevFluids.9.L051602" target="_blank" rel="noopener" className="btn small">
                      🔗 View Paper
                    </a>
                  </div>
                  <div className="label">Plain English Summary</div>
                  <div>
                    This recent paper studies how soap bubbles form and inflate, providing 
                    insights into the detachment process and initial shape formation. It helps 
                    explain why wand motion affects bubble shape and how to model the 
                    launch dynamics.
                  </div>
                  <div className="label">How It Supports POP</div>
                  <div>
                    <strong>Provides insights into bubble formation</strong> and wand interaction 
                    effects. It helps explain why wand motion affects bubble shape and how to 
                    model the launch dynamics.
                  </div>
                </div>
              </div>

              <div className="card">
                <h4>💧 Thin Film Dynamics: Drainage & Stability</h4>
                <div className="kv small">
                  <div className="label">Chatzigiannakis, E. et al. (2021)</div>
                  <div>
                    Thin liquid films: a review. 
                    <em>Current Opinion in Colloid & Interface Science</em>, 56, 101461.
                    <br/>
                    <a href="https://doi.org/10.1016/j.cocis.2021.101461" target="_blank" rel="noopener" className="btn small">
                      🔗 View Paper
                    </a>
                  </div>
                  <div className="label">Plain English Summary</div>
                  <div>
                    This review covers how thin liquid films (like bubble walls) behave, 
                    including drainage, stability, and rupture. Understanding these processes 
                    helps explain bubble lifetime and why some bubbles pop while others 
                    survive longer in the wind.
                  </div>
                  <div className="label">How It Supports POP</div>
                  <div>
                    <strong>Helps understand bubble stability</strong> and lifetime in various 
                    conditions. It explains why some bubbles pop while others survive longer, 
                    which affects the analysis window.
                  </div>
                </div>
              </div>

              <div className="card">
                <h4>📊 Physical Constants: Air Properties</h4>
                <div className="kv small">
                  <div className="label">Lide, D. R. (2004)</div>
                  <div>
                    <em>CRC Handbook of Chemistry and Physics</em>. CRC Press.
                    <br/>
                    <a href="https://www.routledge.com/CRC-Handbook-of-Chemistry-and-Physics-85th-Edition/Lide/p/book/9780849304859" target="_blank" rel="noopener" className="btn small">
                      🔗 View Book
                    </a>
                  </div>
                  <div className="label">Plain English Summary</div>
                  <div>
                    This reference provides the physical constants used in POP's calculations, 
                    including air density (ρ ≈ 1.2 kg/m³), viscosity (μ ≈ 1.8×10⁻⁵ Pa·s), 
                    and how these vary with temperature and humidity.
                  </div>
                  <div className="label">How It Supports POP</div>
                  <div>
                    <strong>Supplies the physical constants</strong> needed for accurate 
                    calculations. It provides the values for air density, viscosity, and 
                    how these vary with environmental conditions.
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
      {refsOpen && <ReferencesModal onClose={closeRefs} />}
    </>
  )
}

