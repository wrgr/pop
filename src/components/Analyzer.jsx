import React, { useEffect, useRef, useState } from 'react'
const start = {x,y}
function move(e){
const xx = e.clientX - r.left, yy = e.clientY - r.top
const dx = xx - start.x, dy = yy - start.y
const a = Math.max(5, Math.abs(dx)), b = Math.max(5, Math.abs(dy))
const angleRad = Math.atan2(dy,dx)
setEllipse({cx:start.x, cy:start.y, a, b, angleRad})
redraw({cx:start.x, cy:start.y, a, b, angleRad})
}
function up(){ window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up) }
window.addEventListener('mousemove',move); window.addEventListener('mouseup',up)

function startScalePick(){ setPickPts([]) }
function onCanvasClick(ev){
if(pickPts === null) return
const c = canvasRef.current; const r = c.getBoundingClientRect()
const pt = {x: ev.clientX - r.left, y: ev.clientY - r.top}
setPickPts(p=>{ const np=[...p,pt]; if(np.length===2){ const d = pxDistance(np[0],np[1]); const cm = parseFloat(prompt('Real distance (cm):','10'))
if(cm>0){ setScalePxPerCm(d/cm) } } return np })
}


function downloadJSON(){ if(!report) return; const blob = new Blob([JSON.stringify(report,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='pop_report.json'; a.click() }


return (
<div className="stack">
<div className="controls">
<label className="btn"><input type="file" accept="image/*,video/*" onChange={onFile}/><span>📎 Choose photo/video</span></label>
<button className="btn" onClick={()=>setManual(m=>!m)}>{manual? '✏️ Manual: ON':'✏️ Manual: OFF'}</button>
<button className="btn" onClick={analyze} disabled={!imgURL}>🔍 Analyze</button>
<button className="btn" onClick={startScalePick}>📏 Set scale</button>
<span className="badge">Vision: {window.__cvReady? 'OpenCV.js ready':'fallback/manual'}</span>
</div>
<canvas ref={canvasRef} width={720} height={440} onMouseDown={onCanvasDown} onClick={onCanvasClick}/>
{report && (
<div className="kv">
<div className="label">Axis ratio (a/b)</div><div>{report.axisRatio}</div>
<div className="label">Deformation D</div><div>{report.D}</div>
<div className="label">Equiv. radius R</div><div>{report.Rcm? report.Rcm.toFixed(1)+' cm' : '— (set scale for cm)'} </div>
<div className="label">Wind class</div><div>{report.wind.class}</div>
<div className="label">Weber (We)</div><div>{report.wind.We.toFixed(2)}</div>
<div className="label">Wind speed U (m/s)</div>
<div><UncertaintyBadge value={report.wind.U} lo={report.wind.Ulo} hi={report.wind.Uhi}/></div>
<div className="label">Download</div><div><button className="btn" onClick={downloadJSON}>⬇️ JSON</button></div>
</div>
)}
</div>
)
