/**
 * Map declutter. Each post is drawn as a box of position cells. Boxes start
 * just above their true location, then get pushed apart until none overlap;
 * a leader line ties each box back to its pin. Runs in screen pixels, so it is
 * recomputed on zoom (not on pan).
 */
export interface Box {
  id: string;
  ax: number; // anchor (true location), px
  ay: number;
  w: number;
  h: number;
  x: number; // box centre after layout
  y: number;
}

export function declutter(boxes: Box[], pad = 4, iterations = 220) {
  for (const b of boxes) {
    b.x = b.ax;
    b.y = b.ay - b.h / 2 - 7;
  }
  // big boxes first so small neighbours move around them
  const order = boxes.slice().sort((a, b) => b.w * b.h - a.w * a.h);
  for (let it = 0; it < iterations; it++) {
    // gentle pull home keeps boxes near their pins; overlaps are resolved after it
    for (const b of boxes) {
      b.x += (b.ax - b.x) * 0.02;
      b.y += (b.ay - b.h / 2 - 7 - b.y) * 0.02;
    }
    let moved = false;
    for (let i = 0; i < order.length; i++) {
      const a = order[i];
      for (let j = i + 1; j < order.length; j++) {
        const b = order[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + pad - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + pad - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // push along the axis of least overlap, weighted so larger boxes move less
        const wa = (b.w * b.h) / (a.w * a.h + b.w * b.h);
        const wb = 1 - wa;
        if (ox < oy) {
          const s = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
          a.x -= s * ox * wa;
          b.x += s * ox * wb;
        } else {
          const s = dy === 0 ? (j % 2 ? 1 : -1) : Math.sign(dy);
          a.y -= s * oy * wa;
          b.y += s * oy * wb;
        }
      }
    }
    if (!moved && it > 20) break;
  }
  return boxes;
}
