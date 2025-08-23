import React, { useRef, useState } from 'react'
import UncertaintyBadge from './UncertaintyBadge.jsx'

// Minimal analyzer that lets the user pick an image and shows a preview.
// The original implementation was incomplete and produced top-level return
// statements that broke the build. This simplified component keeps the UI
// responsive while a fuller analysis implementation can be restored later.

export default function Analyzer() {
  const [imgURL, setImgURL] = useState(null)
  const fileRef = useRef(null)

  function onFile(e) {
    const file = e.target.files?.[0]
    if (file) {
      setImgURL(URL.createObjectURL(file))
    } else {
      setImgURL(null)
    }
  }

  return (
    <div className="stack">
      <div className="controls">
        <label className="btn">
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} />
          <span>📎 Choose photo/video</span>
        </label>
      </div>
      {imgURL && (
        <div className="stack">
          <img src={imgURL} alt="uploaded sample" />
          <div className="kv">
            <div className="label">Wind speed U (m/s)</div>
            <div>
              {/* Placeholder values until real analysis is implemented */}
              <UncertaintyBadge value={0} lo={0} hi={0} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

