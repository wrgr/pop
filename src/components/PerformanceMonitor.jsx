import React, { useEffect, useRef, useState, memo } from 'react'

const PerformanceMonitor = memo(function PerformanceMonitor() {
  const [fps, setFps] = useState(0)
  const [renderCount, setRenderCount] = useState(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const renderCountRef = useRef(0)

  useEffect(() => {
    const measureFPS = () => {
      const now = performance.now()
      frameCountRef.current++
      
      if (now - lastTimeRef.current >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current)))
        frameCountRef.current = 0
        lastTimeRef.current = now
      }
      
      requestAnimationFrame(measureFPS)
    }
    
    const animationId = requestAnimationFrame(measureFPS)
    return () => cancelAnimationFrame(animationId)
  }, [])

  // Only increment render count when component actually re-renders
  // This was causing infinite renders - removed the problematic useEffect
  // useEffect(() => {
  //   renderCountRef.current++
  //   setRenderCount(renderCountRef.current)
  // })

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000
    }}>
      <div>FPS: {fps}</div>
      <div>Renders: {renderCount}</div>
    </div>
  )
})

export default PerformanceMonitor
