// Minimal working example exercising wand modeling and forward/inverse bubble models.
import { makeCircularLoop, simulateWand } from '../src/lib/wand.js';
import { extrudeLoop, inferWindFromSlices } from '../src/lib/geometry.js';
import { mapUToAxisRatio, mapAxisRatioToU } from '../src/lib/inference.js';

// Create a circular wand and apply a bit of sway from wind.
const loop = makeCircularLoop(0.1, 16);
const swayed = simulateWand(loop, {U:1, t:0});

// Extrude through time to form a mesh and infer drift.
const { slices } = extrudeLoop(swayed, {steps:4, wind:[1,0], grow:0.02});
const estimate = inferWindFromSlices(slices, 1);
console.log('Inferred wind:', estimate);

// Demonstrate forward/inverse deformation mapping.
const forward = mapUToAxisRatio(2, 0.15);
console.log('Forward model:', forward);
const inverse = mapAxisRatioToU(forward.chi, 0.15);
console.log('Inverse model:', inverse);

