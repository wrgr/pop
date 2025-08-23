import React, { memo } from 'react'

const Card = memo(function Card({ title, bodyClassName = '', children }) {
  return (
    <section className="card">
      {title && <h2>{title}</h2>}
      <div className={`body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  )
})

export default Card
