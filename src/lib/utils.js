export async function fitEllipseFromCanvas(canvas){
if(!window.cv) throw new Error('OpenCV.js not loaded')
const cv = window.cv
const src = cv.imread(canvas)
const gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
const blur = new cv.Mat(); cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0)
const edges = new cv.Mat(); cv.Canny(blur, edges, 60, 120)
const contours = new cv.MatVector(); const hierarchy = new cv.Mat()
cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE)
let best=null, bestArea=0
for(let i=0;i<contours.size();i++){
const cnt = contours.get(i); if(cnt.size().height < 40) continue
const rect = cv.boundingRect(cnt); const area = rect.width*rect.height
if(area>bestArea){ bestArea=area; best=cnt }
}
if(!best){ src.delete(); gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete(); throw new Error('No contour') }
const el = cv.fitEllipse(best)
const E = { cx: el.center.x, cy: el.center.y, a: el.size.width/2, b: el.size.height/2, angleRad: el.angle*Math.PI/180 }
src.delete(); gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete();
return E
}


export const pxDistance = (p,q)=> Math.hypot(p.x-q.x, p.y-q.y)