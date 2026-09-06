export type ScreenPoint = readonly [number, number];
export interface ScreenBox { left: number; right: number; top: number; bottom: number }

/** Separating-axis test: catch crossing segments even when every star is outside. */
export function boxIntersectsPolygon(box: ScreenBox, polygon: readonly ScreenPoint[]) {
  if (polygon.length < 3) return false;
  const corners: ScreenPoint[] = [[box.left,box.top],[box.right,box.top],[box.right,box.bottom],[box.left,box.bottom]];
  const axes: ScreenPoint[] = [[1,0],[0,1]];
  for (let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length]; axes.push([a[1]-b[1],b[0]-a[0]]);
  }
  return axes.every(([x,y]) => {
    const p=polygon.map(v=>v[0]*x+v[1]*y), q=corners.map(v=>v[0]*x+v[1]*y);
    return Math.max(...p)>=Math.min(...q) && Math.max(...q)>=Math.min(...p);
  });
}
