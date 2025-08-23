# POP — Phil’s Orb Playground


A static, client‑side bubble lab: upload a photo to estimate **wind** (direction/class/speed with uncertainty) and **wand** form, or design a target bubble by adjusting wind, wand jerk, and film cohesion (σ). Built with Vite + React; deployable on GH Pages.

See `help.html` for an extended guide to parameters and operation.


## Install & run
```bash
npm i
npm run dev
# set vite.config.js base to '/<your-repo>/' then
npm run deploy
```


## What the sliders/params mean (with citations)
- **Axis‑ratio ↔ Weber mapping**: we use a compact surrogate
**χ(We) = 1 + c₁·We / (1 + c₂·We)**
where **χ = a/b** (projected ellipse axis ratio). This captures the monotone trend summarized in **Loth (2008)** for deformable drops/bubbles in uniform flow. Tune **c₁** (slope) and **c₂** (saturation) against your calibration.
- **Weber number**: **We = ρ U² R / σ**, linking wind speed **U** and size **R** to deformation via surface tension **σ** ("cohesion").
- **Air viscosity**: **μ_air ≈ 1.8×10⁻⁵ Pa·s**; sets relaxation time scale **τ ~ μ_air R / σ**.
- **Deformation parameter**: **D = (L − B) / (L + B)** (Taylor/Grace tradition) using major/minor diameters of the fitted ellipse.
- **Relaxation time**: order‑of‑magnitude capillary scaling **τ ~ μ_air R / σ** (used for forward relaxation toward spherical when wind decreases).
- **Film drainage** (optional lifetime gauge): canonical thin‑film scaling **∂h/∂t ∝ −h³/(μ R²)**.


### Citations
- Loth, E. (2008). *Quasi‑steady shape and drag of deformable bubbles and drops.* **Int. J. Multiphase Flow**, 34(6), 523‑546. (Axis‑ratio/drag vs Weber correlations.)
- Taylor, G. I. (1934); Grace, H. P. (1971+). (Deformation parameter & shear‑flow droplet deformation framing.)
- Rao, R. et al. (2024). *Dynamics of soap bubble inflation.* **Phys. Rev. Fluids** 9:L051602. (Launch/inflation context.)
- Chatzigiannakis, E. et al. (2021). *Thin liquid films: a review.* **Curr. Opin. Colloid Interface Sci.** 56:101461. (Drainage scaling.)


> This app is educational. For high‑accuracy inference, calibrate with a local anemometer and your exact solution surface tension.