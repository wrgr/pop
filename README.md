# POP — Phil's Orb Playground

**▶️ Live demo: https://wrgr.github.io/pop/**

**Can bubble shape predict wind and wand motion?**

POP is a sophisticated physics-based tool that answers this fundamental question using empirical surrogate laws, dynamic relaxation modeling, and video analysis techniques.

## 🎯 Core Capabilities

### 1. **Inverse Analysis: Photo/Video → Wind & Wand**
- **Single Photo Analysis**: Extract wind speed and direction from bubble deformation
- **Video Analysis**: Separate wand release motion from ambient wind using least-squares fitting
- **Empirical Surrogate Law**: D ≈ k₁We/(1 + k₂We) links deformation to Weber number
- **Confidence Assessment**: Quantify uncertainty in wind inference

### 2. **Forward Prediction: Wind & Wand → Bubble Shape**
- **Shape Prediction**: Generate expected bubble shapes from wind conditions
- **Wand Effects**: Model launch stretch and jerk on final bubble form
- **Dynamic Relaxation**: Account for time-dependent shape adjustment
- **Physical Validation**: Respect fundamental dimensionless groups

### 3. **Scientific Foundation**
- **Weber Number**: Links inertial forces to surface tension
- **Deformation Parameter**: D = (a-b)/(a+b) quantifies bubble elongation
- **Relaxation Dynamics**: τ·dD/dt + D = Φ(We) models shape evolution
- **Bidirectional Inference**: Forward and inverse calculations with error analysis

## 🔬 Physics Model

### Empirical Surrogate Law (Loth 2008)
```
D ≈ k₁We / (1 + k₂We)
We ≈ D / (k₁ - k₂D)
```
where:
- D = deformation parameter
- We = Weber number = ρU²R/σ
- k₁ ≈ 0.24, k₂ ≈ 0.75 (calibrated constants)

### Dimensionless Groups
- **Weber (We)**: Inertial vs. surface tension forces
- **Reynolds (Re)**: Inertial vs. viscous forces  
- **Ohnesorge (Oh)**: Viscous vs. surface tension forces

### Video Analysis
```
U_rel(t) ≈ U_wind - U_bubble(t)
```
Least-squares solution for:
- Constant wind vector U_wind
- Initial wand release velocity U_wand

## 📱 Usage

### Single Photo Analysis
1. Upload bubble image
2. Draw ellipse around bubble outline
3. Set scale using known reference
4. Get wind speed, direction, and confidence

### Video Analysis
1. Upload bubble video
2. Draw ellipses on key frames
3. Add frames to sequence
4. Solve for wind and wand motion

### Forward Simulation
1. Set wind speed and direction
2. Adjust wand parameters
3. View predicted bubble shape
4. Explore parameter sensitivity

## 🚀 Performance Features

- **React.memo**: Prevents unnecessary re-renders
- **useCallback/useMemo**: Optimizes expensive calculations
- **Calculation Caching**: Reuses physics results
- **Debounced Inputs**: Smooth slider interactions
- **RequestAnimationFrame**: 60fps animation loop

## 📚 Scientific References

- **Loth, E. (2008)**: Quasi-steady shape and drag of deformable bubbles
- **Taylor, G.I. (1932)**: Viscosity of fluid containing small drops
- **Clift et al. (1978)**: Bubbles, Drops, and Particles
- **Rallison, J.M. (1984)**: Deformation of small viscous drops in shear flows

## 🎓 Educational Value

POP demonstrates:
- **Inverse Problems**: Inferring causes from effects
- **Empirical Modeling**: Data-driven physics relationships
- **Dimensional Analysis**: Dimensionless groups in fluid mechanics
- **Least-Squares Fitting**: Statistical parameter estimation
- **Dynamic Systems**: Time-dependent shape evolution

## 🔧 Technical Details

- **Frontend**: React 18 with optimized rendering
- **Physics**: Custom JavaScript physics engine
- **Graphics**: HTML5 Canvas with optimized drawing
- **Math**: Linear algebra solvers for least-squares fitting
- **Performance**: 60fps animation with minimal CPU usage

## 📊 Answer to the Core Question

**Yes, bubble shape can predict wind and wand motion with sufficient sophistication:**

1. **Shape → Wind**: Deformation D maps to Weber number via empirical law
2. **Weber → Velocity**: U = √(We·σ/ρR) gives wind speed
3. **Orientation → Direction**: Major axis tilt indicates wind direction
4. **Video → Separation**: Time-resolved analysis separates wand from wind
5. **Confidence**: Uncertainty quantification validates predictions

The key insight is the **empirical surrogate law** that provides the crucial link between observable bubble deformation and underlying flow physics, enabling bidirectional inference with physical validation.

---

*POP is a teaching tool that demonstrates the power of physics-based modeling for inverse problems in fluid mechanics.*