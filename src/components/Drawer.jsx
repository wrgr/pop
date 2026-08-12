import React, { memo } from 'react'

// A lightweight collapsible section built on native <details>/<summary> — no
// dependencies, keyboard-accessible, and it remembers nothing (open state is
// the browser's). Use it to tuck away secondary content so the page reads as a
// short stack of cards with detail on demand.
const Drawer = memo(function Drawer({ title, children, defaultOpen = false, className = '' }) {
  return (
    <details className={`drawer ${className}`.trim()} open={defaultOpen}>
      <summary>
        <span className="drawer-title">{title}</span>
        <span className="drawer-chevron" aria-hidden="true">▸</span>
      </summary>
      <div className="drawer-body">{children}</div>
    </details>
  )
})

export default Drawer
