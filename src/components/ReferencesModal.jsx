import React, { memo } from 'react'

const ReferencesModal = memo(function ReferencesModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📖 How to Use POP</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="stack">
            <div className="card">
              <h3>🫧 Live Physics — the forward model</h3>
              <div className="stack small">
                <ul>
                  <li>Hit <strong>Launch bubble</strong> and watch a real soft-body soap film deform, drift and pop in the wind.</li>
                  <li>Choose a <strong>launcher</strong>: a compliant <em>string loop</em>, a <em>rigid wand</em>, or a <em>custom loop</em> you draw — the loop's shape becomes the bubble's.</li>
                  <li>Dial <strong>wind, direction, gust and launch</strong> up top; open <strong>More parameters</strong> for gravity (Bond number), film thickness, wake and spin.</li>
                  <li>Toggle <strong>2D / 3D</strong> to see the same physics as a shaded, refracting 3D bubble.</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>🎥 Record &amp; analyze — the inverse</h3>
              <div className="stack small">
                <p style={{ margin: 0 }}>
                  Press <strong>Record &amp; analyze</strong> to fly a bubble and read the scene back out
                  of its shape over time — wind, gravity, the launcher, the film's ring, any spin. A
                  single frame is ambiguous; the time course pulls the causes apart.
                </p>
              </div>
            </div>

            <div className="card">
              <h3>🎯 Coach — make it "better"</h3>
              <div className="stack small">
                <p style={{ margin: 0 }}>
                  In the analysis, pick a goal — <strong>bigger, longer-lasting, faster, or sturdier</strong> —
                  and POP ranks concrete levers (loop size, surface tension, film, wind) with the physics
                  behind each, plus the effects it doesn't model yet.
                </p>
              </div>
            </div>

            <div className="card">
              <h3>🔍 Analyzer — from a real photo or video</h3>
              <div className="stack small">
                <ol>
                  <li><strong>Upload</strong> a clear bubble photo or video.</li>
                  <li><strong>Drag</strong> on the canvas to fit an ellipse to the bubble.</li>
                  <li><strong>Set scale</strong> (📏, or from a known object) for results in real units.</li>
                  <li><strong>Analyze</strong> for wind speed, direction and confidence. For video, add several frames first to separate wand launch from ambient wind.</li>
                </ol>
              </div>
            </div>

            <div className="card">
              <h3>🧪 The physics, briefly</h3>
              <div className="stack small">
                <ul>
                  <li><strong>Deformation</strong> D = (a−b)/(a+b) measures elongation.</li>
                  <li><strong>Weber number</strong> We = ρU²R/σ links wind stress to surface tension; the surrogate law D ≈ k₁We/(1 + k₂We) (Loth 2008) connects the two.</li>
                  <li><strong>Bond number</strong> Bo = ρgR²/σ sets gravity sag and the size limit.</li>
                  <li>Shape lags the wind by a relaxation time τ — which is why a <em>series</em> tells you more than one frame.</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>⚠️ Good to know</h3>
              <div className="stack small">
                <ul>
                  <li>POP is a teaching tool with literature-inspired heuristics — treat numbers as estimates, and calibrate for your own setup.</li>
                  <li>The Analyzer fits a 2D ellipse, so perspective and a bubble's true 3D shape add uncertainty.</li>
                  <li>A single photo can't separate wand launch from wind — use video (or the recorder) for that.</li>
                  <li>POP now drains and evaporates the film to a timed lifetime, but wind's effect on that life is still weak — see the Coach's "what POP doesn't model" for the remaining open questions.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Got it!</button>
        </div>
      </div>
    </div>
  )
})

export default ReferencesModal
