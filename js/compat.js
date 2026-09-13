// 浏览器兼容垫片：必须在所有其他模块之前加载（main.js 的第一个 import）
// iOS 15 及更早的 Safari、部分安卓 WebView 没有 CanvasRenderingContext2D.roundRect，
// 没有这个垫片会直接 TypeError，被入口当成"设备跑不起来 3D"误报。
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    let radii;
    if (typeof r === 'number') radii = [r, r, r, r];
    else if (Array.isArray(r)) {
      radii = [r[0] || 0, r[1] || r[0] || 0, r[2] || r[0] || 0, r[3] || r[1] || r[0] || 0];
    } else radii = [0, 0, 0, 0];
    const [tl, tr, br, bl] = radii.map(v => Math.max(0, Math.min(v, Math.abs(w) / 2, Math.abs(h) / 2)));
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.arcTo(x + w, y, x + w, y + tr, tr);
    this.lineTo(x + w, y + h - br);
    this.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.lineTo(x + bl, y + h);
    this.arcTo(x, y + h, x, y + h - bl, bl);
    this.lineTo(x, y + tl);
    this.arcTo(x, y, x + tl, y, tl);
    return this;
  };
}
