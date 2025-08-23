// Geometry utilities for bubble surfaces.
// We loft time-sequenced loops of string control points into a triangular mesh
// representing the bubble film. The algorithm sweeps each ring forward and
// connects corresponding vertices between slices.
//
// References:
//  - Botsch et al., *Polygon Mesh Processing* (2010)
//  - Paoli et al., "Soap films and minimal surfaces" (2011)

/**
 * Generate a triangle mesh by lofting consecutive slices.
 * @param {Array<Array<{x:number,y:number,z:number}>>} slices
 *   Array of closed loops; each loop must have equal vertex counts.
 * @returns {{vertices:Array<[number,number,number]>,faces:Array<[number,number,number]>}}
 */
export function loftSurface(slices){
  const vertices=[]; const faces=[];
  if(!slices || slices.length<2) return {vertices, faces};
  const nPts = slices[0].length;
  for(const loop of slices){
    if(loop.length!==nPts) throw new Error('Inconsistent slice size');
    for(const p of loop) vertices.push([p.x,p.y,p.z]);
  }
  for(let i=0;i<slices.length-1;i++){
    for(let j=0;j<nPts;j++){
      const a=i*nPts+j;
      const b=i*nPts+((j+1)%nPts);
      const c=(i+1)*nPts+j;
      const d=(i+1)*nPts+((j+1)%nPts);
      faces.push([a,b,d]);
      faces.push([a,d,c]);
    }
  }
  return {vertices, faces};
}

/**
 * Extrude an initial loop forward in time to form slices.
 * @param {Array<{x:number,y:number}>} loop - 2D control points of the wand string.
 * @param {Object} opts
 * @param {number} opts.steps  - Number of slices.
 * @param {Array<number>} opts.wind - [Ux, Uy] drift per step.
 * @param {number} opts.grow   - Growth in z per step.
 * @returns {{slices:Array<Array<{x:number,y:number,z:number}>>,mesh:{vertices:Array,faces:Array}}}
 */
export function extrudeLoop(loop,{steps=2,wind=[0,0],grow=1}={}){
  const slices=[];
  for(let i=0;i<steps;i++){
    slices.push(loop.map(p=>({x:p.x+wind[0]*i,y:p.y+wind[1]*i,z:grow*i})));
  }
  const mesh = loftSurface(slices);
  return {slices, mesh};
}

function centroid(loop){
  const n=loop.length; let cx=0,cy=0,cz=0;
  for(const p of loop){cx+=p.x;cy+=p.y;cz+=p.z;}
  return {x:cx/n,y:cy/n,z:cz/n};
}

/**
 * Infer average wind vector from a sequence of slices.
 * Wind is approximated as horizontal motion of the centroid.
 * @param {Array<Array<{x:number,y:number,z:number}>>} slices
 * @param {number} dt - time step between slices
 * @returns {{wind:[number,number],rise:number}}
 */
export function inferWindFromSlices(slices, dt){
  if(!slices || slices.length<2) return {wind:[0,0], rise:0};
  const c0=centroid(slices[0]);
  const c1=centroid(slices[slices.length-1]);
  const steps = (slices.length-1)*dt;
  return {
    wind: [(c1.x-c0.x)/steps, (c1.y-c0.y)/steps],
    rise: (c1.z-c0.z)/steps
  };
}

