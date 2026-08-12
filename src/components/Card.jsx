import React, { memo } from 'react'

const Card = memo(function Card({ title, bodyClassName = '', className = '', children }) {
  return (
    <section className={`card ${className}`.trim()}>
      {title && <h2>{title}</h2>}
      <div className={`body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  )
})

export default Card
