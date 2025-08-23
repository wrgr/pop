/**
 * Sophisticated physics model for inferring wind and wand motion from bubble shapes
 * Based on empirical surrogate laws and dynamic relaxation modeling
 */

// Empirical constants from Loth 2008
const K1 = 0.24  // Primary deformation constant
const K2 = 0.75  // Secondary deformation constant

/**
 * Compute deformation parameter D from axis ratio
 * D = (a-b)/(a+b) = (χ-1)/(χ+1)
 */
export function deformationD(a, b) {
  const chi = Math.max(a, b) / Math.min(a, b)
  return (chi - 1) / (chi + 1)
}

/**
 * Compute axis ratio χ from deformation parameter
 * χ = (1+D)/(1-D)
 */
export function axisRatioFromD(D) {
  return (1 + D) / (1 - D)
}

/**
 * Estimate Weber number from deformation using empirical surrogate law
 * D ≈ k1*We / (1 + k2*We)
 * We ≈ D / (k1 - k2*D)
 */
export function weberFromDeformation(D) {
  if (D <= 0 || D >= K1/K2) {
    return null // Invalid deformation range
  }
  return D / (K1 - K2 * D)
}

/**
 * Estimate deformation from Weber number using empirical surrogate law
 * D ≈ k1*We / (1 + k2*We)
 */
export function deformationFromWeber(We) {
  if (We < 0) return null
  return (K1 * We) / (1 + K2 * We)
}

/**
 * Compute relative velocity from Weber number and bubble properties
 * U_rel = sqrt(We * σ / (ρ * R))
 */
export function velocityFromWeber(We, R, sigma = 0.03, rho = 1.2) {
  if (We <= 0 || R <= 0) return null
  return Math.sqrt((We * sigma) / (rho * R))
}

/**
 * Compute Weber number from velocity and bubble properties
 * We = ρ * U² * R / σ
 */
export function weberFromVelocity(U, R, sigma = 0.03, rho = 1.2) {
  if (U <= 0 || R <= 0) return null
  return (rho * U * U * R) / sigma
}

/**
 * Estimate effective radius from ellipse semi-axes
 * R ≈ sqrt(ab)
 */
export function effectiveRadius(a, b) {
  return Math.sqrt(a * b)
}

/**
 * Compute relaxation time constant
 * τ ~ μ_eff * R / σ
 */
export function relaxationTime(R, sigma = 0.03, muEff = 1.8e-5) {
  return (muEff * R) / sigma
}

/**
 * Dynamic relaxation model for shape adjustment
 * τ * dD/dt + D(t) = Φ(We_t)
 */
export function dynamicRelaxation(D_current, We_target, dt, tau) {
  const D_target = deformationFromWeber(We_target)
  if (D_target === null) return D_current
  
  const relaxationRate = (D_target - D_current) / tau
  return D_current + relaxationRate * dt
}

/**
 * Extract wind direction from ellipse orientation
 * Returns angle in radians (0 = right, π/2 = up)
 */
export function windDirectionFromEllipse(a, b, angleRad) {
  // Major axis direction indicates wind direction
  return angleRad
}

/**
 * Video frame analysis for time-resolved inference
 */
export class VideoAnalyzer {
  constructor() {
    this.frames = []
    this.windEstimate = null
    this.wandReleaseVelocity = null
  }

  /**
   * Add a frame with fitted ellipse data
   */
  addFrame(timestamp, ellipse, centroid) {
    const { a, b, angleRad } = ellipse
    const D = deformationD(a, b)
    const R = effectiveRadius(a, b)
    
    this.frames.push({
      timestamp,
      ellipse: { a, b, angleRad },
      centroid,
      D,
      R,
      windDirection: windDirectionFromEllipse(a, b, angleRad)
    })
  }

  /**
   * Estimate bubble velocity between consecutive frames
   */
  estimateBubbleVelocity(frame1, frame2) {
    const dt = frame2.timestamp - frame1.timestamp
    if (dt <= 0) return { vx: 0, vy: 0 }
    
    const dx = frame2.centroid.x - frame1.centroid.x
    const dy = frame2.centroid.y - frame1.centroid.y
    
    return {
      vx: dx / dt,
      vy: dy / dt
    }
  }

  /**
   * Solve for wind and wand release velocity using least squares
   * U_rel(t) ≈ U_wind - U_bubble(t)
   */
  solveWindAndWand() {
    if (this.frames.length < 3) return null

    // Build system of equations for least squares
    const equations = []
    const targets = []

    for (let i = 1; i < this.frames.length; i++) {
      const prev = this.frames[i-1]
      const curr = this.frames[i]
      
      // Estimate bubble velocity
      const bubbleVel = this.estimateBubbleVelocity(prev, curr)
      
      // Estimate relative velocity from deformation
      const We = weberFromDeformation(curr.D)
      if (We === null) continue
      
      const U_rel_magnitude = velocityFromWeber(We, curr.R)
      if (U_rel_magnitude === null) continue
      
      // Wind direction from ellipse orientation
      const windDir = curr.windDirection
      const U_rel_x = U_rel_magnitude * Math.cos(windDir)
      const U_rel_y = U_rel_magnitude * Math.sin(windDir)
      
      // Equation: U_wind - U_bubble = U_rel
      equations.push([
        [1, 0, -1, 0],  // U_wind_x - U_bubble_x = U_rel_x
        [0, 1, 0, -1]   // U_wind_y - U_bubble_y = U_rel_y
      ])
      
      targets.push([U_rel_x, U_rel_y])
    }

    if (equations.length === 0) return null

    // Solve least squares system
    // This is a simplified solver - in practice you'd use a proper linear algebra library
    const result = this.solveLeastSquares(equations, targets)
    
    if (result) {
      this.windEstimate = {
        vx: result[0],
        vy: result[1]
      }
      this.wandReleaseVelocity = {
        vx: result[2],
        vy: result[3]
      }
    }

    return {
      wind: this.windEstimate,
      wandRelease: this.wandReleaseVelocity
    }
  }

  /**
   * Simple least squares solver for 4x4 system
   */
  solveLeastSquares(equations, targets) {
    // Simplified solver - in production use a proper library like mathjs
    // This is a basic implementation for demonstration
    
    let A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    let b = [0, 0, 0, 0]
    
    // Build normal equations A^T * A * x = A^T * b
    for (let i = 0; i < equations.length; i++) {
      const eq = equations[i]
      const target = targets[i]
      
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 4; k++) {
          for (let l = 0; l < 4; l++) {
            A[k][l] += eq[j][k] * eq[j][l]
          }
          b[k] += eq[j][k] * target[j]
        }
      }
    }
    
    // Simple Gaussian elimination (not robust for production)
    try {
      return this.gaussianElimination(A, b)
    } catch (e) {
      console.warn('Matrix solution failed:', e)
      return null
    }
  }

  /**
   * Basic Gaussian elimination solver
   */
  gaussianElimination(A, b) {
    const n = A.length
    const x = new Array(n).fill(0)
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const factor = A[j][i] / A[i][i]
        for (let k = i; k < n; k++) {
          A[j][k] -= factor * A[i][k]
        }
        b[j] -= factor * b[i]
      }
    }
    
    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0
      for (let j = i + 1; j < n; j++) {
        sum += A[i][j] * x[j]
      }
      x[i] = (b[i] - sum) / A[i][i]
    }
    
    return x
  }

  /**
   * Get analysis summary
   */
  getSummary() {
    if (!this.windEstimate) return null
    
    const windSpeed = Math.sqrt(
      this.windEstimate.vx * this.windEstimate.vx + 
      this.windEstimate.vy * this.windEstimate.vy
    )
    const windDirection = Math.atan2(this.windEstimate.vy, this.windEstimate.vx)
    
    const wandSpeed = Math.sqrt(
      this.wandReleaseVelocity.vx * this.wandReleaseVelocity.vx + 
      this.wandReleaseVelocity.vy * this.wandReleaseVelocity.vy
    )
    const wandDirection = Math.atan2(this.wandReleaseVelocity.vy, this.wandReleaseVelocity.vx)
    
    return {
      wind: {
        speed: windSpeed,
        direction: windDirection,
        vx: this.windEstimate.vx,
        vy: this.windEstimate.vy
      },
      wand: {
        speed: wandSpeed,
        direction: wandDirection,
        vx: this.wandReleaseVelocity.vx,
        vy: this.wandReleaseVelocity.vy
      },
      frames: this.frames.length,
      confidence: this.estimateConfidence()
    }
  }

  /**
   * Estimate confidence in the solution
   */
  estimateConfidence() {
    if (this.frames.length < 3) return 0
    
    // Simple confidence based on frame count and consistency
    let consistency = 0
    for (let i = 1; i < this.frames.length; i++) {
      const prev = this.frames[i-1]
      const curr = this.frames[i]
      
      // Check if deformation changes are reasonable
      const dD = Math.abs(curr.D - prev.D)
      if (dD < 0.1) consistency += 1
    }
    
    const frameScore = Math.min(this.frames.length / 10, 1)
    const consistencyScore = consistency / Math.max(this.frames.length - 1, 1)
    
    return (frameScore + consistencyScore) / 2
  }
}

/**
 * Single photo analysis for snapshot inference
 */
export function analyzeSinglePhoto(ellipse, scalePxPerCm, sigma = 0.03, rho = 1.2) {
  const { a, b, angleRad } = ellipse
  
  // Step 1: Compute deformation and axis ratio
  const D = deformationD(a, b)
  const chi = a / b
  
  // Step 2: Estimate effective radius
  const R_pixels = effectiveRadius(a, b)
  const R_meters = scalePxPerCm ? (R_pixels / scalePxPerCm) / 100 : null
  
  // Step 3: Weber number from deformation
  const We = weberFromDeformation(D)
  if (We === null) return null
  
  // Step 4: Solve for velocity
  const U_rel = velocityFromWeber(We, R_meters || 0.01, sigma, rho)
  if (U_rel === null) return null
  
  // Step 5: Wind direction from ellipse orientation
  const windDirection = windDirectionFromEllipse(a, b, angleRad)
  const windDirectionDegrees = (windDirection * 180) / Math.PI
  
  // Step 6: Relaxation time
  const tau = relaxationTime(R_meters || 0.01, sigma)
  
  // Step 7: Confidence assessment
  const confidence = assessPhotoConfidence(D, We, R_meters)
  
  return {
    // Shape parameters
    axisRatio: chi,
    deformation: D,
    effectiveRadius: R_meters,
    
    // Flow parameters
    weberNumber: We,
    relativeVelocity: U_rel,
    windDirection: windDirectionDegrees,
    
    // Physical parameters
    relaxationTime: tau,
    surfaceTension: sigma,
    airDensity: rho,
    
    // Analysis quality
    confidence,
    
    // Interpretation
    interpretation: interpretWindConditions(U_rel, windDirectionDegrees)
  }
}

/**
 * Assess confidence in single photo analysis
 */
function assessPhotoConfidence(D, We, R) {
  let score = 0
  
  // Deformation range check
  if (D > 0 && D < 0.2) score += 0.3
  else if (D >= 0.2 && D < 0.4) score += 0.2
  else score += 0.1
  
  // Weber number range check
  if (We > 0 && We < 10) score += 0.3
  else if (We >= 10 && We < 50) score += 0.2
  else score += 0.1
  
  // Radius check
  if (R && R > 0.005 && R < 0.1) score += 0.2
  else score += 0.1
  
  // Overall confidence
  if (score >= 0.7) return 'high'
  else if (score >= 0.4) return 'medium'
  else return 'low'
}

/**
 * Interpret wind conditions from velocity and direction
 */
function interpretWindConditions(velocity, direction) {
  let speedClass = 'calm'
  if (velocity < 0.5) speedClass = 'calm'
  else if (velocity < 2.0) speedClass = 'light breeze'
  else if (velocity < 5.0) speedClass = 'moderate breeze'
  else if (velocity < 8.0) speedClass = 'fresh breeze'
  else speedClass = 'strong wind'
  
  let directionClass = 'variable'
  if (direction >= -22.5 && direction < 22.5) directionClass = 'easterly'
  else if (direction >= 22.5 && direction < 67.5) directionClass = 'northeasterly'
  else if (direction >= 67.5 && direction < 112.5) directionClass = 'northerly'
  else if (direction >= 112.5 && direction < 157.5) directionClass = 'northwesterly'
  else if (direction >= 157.5 && direction < 202.5) directionClass = 'westerly'
  else if (direction >= 202.5 && direction < 247.5) directionClass = 'southwesterly'
  else if (direction >= 247.5 && direction < 292.5) directionClass = 'southerly'
  else if (direction >= 292.5 && direction < 337.5) directionClass = 'southeasterly'
  else directionClass = 'easterly'
  
  return {
    speedClass,
    directionClass,
    description: `${speedClass} wind from ${directionClass} direction`
  }
}
