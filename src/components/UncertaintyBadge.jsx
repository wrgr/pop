import React from 'react'
export default function UncertaintyBadge({ value, lo, hi }){
if(value==null) return null
return (
<span className="badge">{value.toFixed(2)} <span className="small">m/s</span> <span className="small">[{lo.toFixed(2)}–{hi.toFixed(2)}]</span></span>
)
}
