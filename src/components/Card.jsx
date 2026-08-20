import React, { memo } from 'react'

const Card = memo(function Card({ title, bodyClassName = '', className = '', hidden = false, children }) {
  return (
    <section className={`card ${className}`.trim()} hidden={hidden}>
      {title && <h2>{title}</h2>}
      <div className={`body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  )
})

export default Card
