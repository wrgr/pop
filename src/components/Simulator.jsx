import React, { useEffect, useRef, useState } from 'react'
if(swayed.length){ ctx.moveTo(swayed[0].x, swayed[0].y); for(let i=1;i<swayed.length;i++){ ctx.lineTo(swayed[i].x, swayed[i].y) } }
ctx.stroke(); ctx.restore()
// Bubble
if(!st) return
ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.ang)
ctx.strokeStyle='#3ad1c9'; ctx.lineWidth=2
ctx.beginPath(); ctx.ellipse(0,0, st.a*100, st.b*100, 0, 0, Math.PI*2); ctx.stroke()
ctx.restore()



const advice = adviceFromParams(params)


return (
<div className="stack">
<div className="controls" style={{gap:16}}>
<label className="pill">🌬️ U <input type="range" min="0" max="10" step="0.1" value={params.U} onChange={e=>ui('U',parseFloat(e.target.value))}/> {params.U.toFixed(1)} m/s</label>
<label className="pill">🧭 Dir <input type="range" min="0" max="360" step="1" value={params.dir} onChange={e=>ui('dir',parseFloat(e.target.value))}/> {params.dir}°</label>
<label className="pill">🪄 Jerk <input type="range" min="0" max="1" step="0.01" value={params.jerk} onChange={e=>ui('jerk',parseFloat(e.target.value))}/> {params.jerk.toFixed(2)}</label>
<label className="pill">⚪ Ø <input type="range" min="5" max="80" step="1" value={params.Rcm} onChange={e=>ui('Rcm',parseFloat(e.target.value))}/> {params.Rcm} cm</label>
<label className="pill">σ <input type="range" min="0.015" max="0.04" step="0.001" value={params.sigma} onChange={e=>ui('sigma',parseFloat(e.target.value))}/> {params.sigma.toFixed(3)} N/m</label>
<label className="pill">τs <input type="range" min="0.05" max="0.8" step="0.01" value={cal.tau} onChange={e=>uical('tau',parseFloat(e.target.value))}/> {cal.tau.toFixed(2)} s</label>
<label className="pill">G <input type="range" min="0" max="1" step="0.02" value={cal.shearGain} onChange={e=>uical('shearGain',parseFloat(e.target.value))}/> {cal.shearGain.toFixed(2)}</label>
<button className="btn primary" onClick={run}>▶️ Run 3s sim</button>
</div>
<div className="notice small">Edit the wand string below. The mouth orientation and span seed the initial bubble elongation and angle at detachment.</div>
<WandEditor points={wandPts} onChange={setWandPts} width={720} height={180} />
<div className="sim-wrap">
<canvas ref={canvasRef} width={720} height={360}></canvas>
</div>
<div className="kv">
<div className="label">Predicted axis ratio</div><div>{simOutputs? simOutputs.axisRatio.toFixed(2): '—'}</div>
<div className="label">Deformation D</div><div>{simOutputs? simOutputs.D.toFixed(2): '—'}</div>
<div className="label">Guidance</div><div>{advice}</div>
</div>
</div>
)



function defaultLoop(){
// A simple two-string rectangular loop template
const w=720, h=180
const cx=w*0.5, cy=h*0.6, span=220, drop=100
return [
{x:cx-span/2, y:cy},
{x:cx-span/2, y:cy+drop},
{x:cx+span/2, y:cy+drop},
{x:cx+span/2, y:cy}
]
}