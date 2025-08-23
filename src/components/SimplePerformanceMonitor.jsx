import React, { useEffect, useRef, useState, memo } from 'react'

// Simple performance monitor that only tracks FPS, not render count
const SimplePerformanceMonitor = memo(function SimplePerformanceMonitor() {
  const [fps, setFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

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
      <div>Status: Optimized</div>
    </div>
  )
})

export default SimplePerformanceMonitor
