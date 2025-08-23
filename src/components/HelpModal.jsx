import React from 'react'

export default function HelpModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '12px',
          maxWidth: '720px',
          maxHeight: '80%',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>How to Use POP</h3>
        <p>
          <b>Analyzer</b>: drop a bubble photo/video to estimate wind and wand
          parameters. Adjust the detected ellipse and scale for better fits.
        </p>
        <p>
          <b>Simulator</b>: tweak wind, direction, wand jerk and bubble size to
          sketch the expected bubble shape.
        </p>
        <h4>Model Parameters</h4>
        <ul>
          <li>
            <b>c1 (0.9)</b>: slope for the axis‑ratio ↔ Weber mapping.
          </li>
          <li>
            <b>c2 (0.35)</b>: saturation of the axis‑ratio ↔ Weber mapping.
          </li>
          <li>
            <b>ρ air (1.20&nbsp;kg/m³)</b>: ambient air density.
          </li>
          <li>
            <b>μ air (1.80×10⁻⁵&nbsp;Pa·s)</b>: dynamic viscosity of air.
          </li>
          <li>
            <b>σ film (0.03&nbsp;N/m)</b>: surface tension of the bubble film.
          </li>
          <li>
            <b>R fallback (20&nbsp;cm)</b>: radius used when image scale is
            unknown.
          </li>
          <li>
            <b>g (9.81&nbsp;m/s²)</b>: gravitational acceleration for drainage
            and settling estimates.
          </li>
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

