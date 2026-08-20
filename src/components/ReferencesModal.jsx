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
              <h3>🫧 Play — the forward model</h3>
              <div className="stack small">
                <ul>
                  <li>Press a <strong>Scenario</strong> for an instant interesting bubble, or hit <strong>Launch</strong> and drag the <strong>Wind</strong> slider.</li>
                  <li>Watch a real soft-body soap film deform, drift and pop — nothing is a pre-baked ellipse.</li>
                  <li>Open the <strong>Fine-tune</strong> tray for the launcher (string loop, rigid wand, or a custom loop you draw), wind detail and 2D/3D; the <strong>Film, gravity, mix &amp; spin</strong> tray for the rest.</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>🎯 Coach — harder, better, faster, stronger</h3>
              <div className="stack small">
                <p style={{ margin: 0 }}>
                  Set the scene in <strong>Play</strong>, switch to <strong>Coach</strong>, and pick a goal —{' '}
                  <strong>harder, better, faster, or stronger</strong> (the song: resists popping, bigger,
                  quicker, longer flight). POP flies your bubble, scores it, and ranks concrete levers with
                  the physics behind each. A tray shows it reading the bubble backwards (recovered vs. set),
                  and another lists what POP doesn't model yet.
                </p>
              </div>
            </div>

            <div className="card">
              <h3>🔎 Analyze — from a real photo or video</h3>
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
                  <li>POP now models the film's whole life — drainage, evaporation, crosswind thinning, its weight (heavy sinks, thin hangs) and a conditioned mix's toughness — but not yet the rising warm-breath bubble or thin-film colours; see the Coach's "what POP doesn't model" for the open questions.</li>
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
