// Simple wand modeling utilities.
// Provides helpers to create loop geometries and animate them under wind sway.

import { swayPoints } from './physics.js';

/**
 * Create a planar circular loop of control points.
 * @param {number} r   Radius of loop in arbitrary units.
 * @param {number} n   Number of discretization points.
 * @returns {Array<{x:number,y:number}>}
 */
export function makeCircularLoop(r=1, n=32){
  const pts=[];
  for(let i=0;i<n;i++){
    const th = 2*Math.PI*i/n;
    pts.push({x: r*Math.cos(th), y: r*Math.sin(th)});
  }
  return pts;
}

/**
 * Apply a crude sway model to a loop to mimic wind interaction.
 * Uses the existing swayPoints helper from physics.js.
 * @param {Array<{x:number,y:number}>} loop
 * @param {object} opts
 * @param {number} opts.U  Wind speed (m/s) proxy controlling amplitude.
 * @param {number} opts.t  Time parameter in seconds.
 * @returns {Array<{x:number,y:number}>} Swayed control points.
 */
export function simulateWand(loop, {U=0, t=0}={}){
  return swayPoints(loop, U, t);
}

