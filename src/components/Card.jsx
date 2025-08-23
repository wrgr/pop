import React from 'react'

export default function Card({ title, bodyClassName = '', children }) {
  return (
    <section className="card">
      {title && <h2>{title}</h2>}
      <div className={`body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  )
}
