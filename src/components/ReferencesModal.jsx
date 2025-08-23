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
              <h3>🔍 Inverse Analysis: Photo/Video → Wind & Wand</h3>
              <div className="stack small">
                <h4>Single Photo Analysis:</h4>
                <ol>
                  <li><strong>Upload:</strong> Choose a clear bubble photo</li>
                  <li><strong>Draw:</strong> Drag on canvas to fit ellipse around bubble</li>
                  <li><strong>Scale:</strong> Use 📏 to set real-world scale (cm)</li>
                  <li><strong>Analyze:</strong> Click 🔍 to get wind speed, direction, and confidence</li>
                </ol>
                
                <h4>Video Analysis:</h4>
                <ol>
                  <li><strong>Upload:</strong> Choose bubble video</li>
                  <li><strong>Frame by Frame:</strong> Draw ellipses on key frames</li>
                  <li><strong>Build Sequence:</strong> Use ➕ to add frames to analysis</li>
                  <li><strong>Solve:</strong> Click 🔍 to separate wand motion from ambient wind</li>
                </ol>
              </div>
            </div>

            <div className="card">
              <h3>🔮 Forward Prediction: Wind & Wand → Bubble</h3>
              <div className="stack small">
                <h4>Wind Parameters:</h4>
                <ul>
                  <li><strong>Wind Speed:</strong> Adjust U slider (0-10 m/s)</li>
                  <li><strong>Launch Jerk:</strong> Control detachment stretch (0-1)</li>
                  <li><strong>Bubble Radius:</strong> Set expected size (5-80 cm)</li>
                </ul>
                
                <h4>Bubble Solution:</h4>
                <ul>
                  <li><strong>Surface Tension:</strong> Adjust σ for soap concentration</li>
                  <li><strong>Air Density:</strong> Modify ρ for altitude/temperature</li>
                  <li><strong>Viscosity:</strong> Set μ for humidity effects</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>🎨 Wand & String Editor</h3>
              <div className="stack small">
                <h4>Wand Setup:</h4>
                <ul>
                  <li><strong>Two Rods:</strong> Red handles represent wand positions</li>
                  <li><strong>Drag Wands:</strong> Click and drag red handles to position</li>
                  <li><strong>String Loop:</strong> Blue points form the bubble-forming loop</li>
                </ul>
                
                <h4>String Control:</h4>
                <ul>
                  <li><strong>Add Points:</strong> Use ➕ to increase loop complexity</li>
                  <li><strong>Remove Points:</strong> Use ➖ to simplify loop</li>
                  <li><strong>Shape Loop:</strong> Drag blue points to desired shape</li>
                  <li><strong>Reset:</strong> Use 🔁 to return to default setup</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>🧪 Scientific Foundation</h3>
              <div className="stack small">
                <h4>Key Concepts:</h4>
                <ul>
                  <li><strong>Weber Number:</strong> Links inertial forces to surface tension</li>
                  <li><strong>Deformation Parameter:</strong> D = (a-b)/(a+b) quantifies elongation</li>
                  <li><strong>Empirical Surrogate Law:</strong> D ≈ k₁We/(1 + k₂We) from Loth (2008)</li>
                  <li><strong>Bidirectional Inference:</strong> Forward and inverse calculations</li>
                </ul>
                
                <h4>Physical Validation:</h4>
                <ul>
                  <li><strong>Dimensionless Groups:</strong> We, Re, Oh respect fundamental physics</li>
                  <li><strong>Relaxation Dynamics:</strong> τ·dD/dt + D = Φ(We) models evolution</li>
                  <li><strong>Confidence Assessment:</strong> Uncertainty quantification for predictions</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>💡 Tips for Best Results</h3>
              <div className="stack small">
                <ul>
                  <li><strong>Clear Images:</strong> Use high-contrast photos with minimal background</li>
                  <li><strong>Accurate Ellipse:</strong> Fit the bubble outline precisely</li>
                  <li><strong>Proper Scale:</strong> Use known reference distances for accurate results</li>
                  <li><strong>Multiple Frames:</strong> More video frames improve wind/wand separation</li>
                  <li><strong>Solution Properties:</strong> Adjust soap concentration and temperature for your mix</li>
                  <li><strong>Wand Geometry:</strong> Realistic wand separation improves predictions</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>⚠️ Limitations & Considerations</h3>
              <div className="stack small">
                <ul>
                  <li><strong>Single Photo:</strong> Cannot separate wand motion from ambient wind</li>
                  <li><strong>Empirical Model:</strong> Accuracy depends on calibration with your setup</li>
                  <li><strong>Bubble Size:</strong> Works best for bubbles 5-80 cm diameter</li>
                  <li><strong>Wind Range:</strong> Optimal for 0.5-8 m/s wind speeds</li>
                  <li><strong>Solution Age:</strong> Fresh soap solutions give most consistent results</li>
                  <li><strong>Environmental Factors:</strong> Temperature and humidity affect surface tension</li>
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
