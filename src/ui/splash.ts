/**
 * SUPERESSENCE studio intro (original identity): darkness → a single spark → a swarm of particles →
 * they gather into the "Essence Drop" symbol → wordmark → energy sweep → flash.
 */
export function playStudioIntro(host: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'splash';
    const cv = document.createElement('canvas');
    wrap.appendChild(cv);
    host.appendChild(wrap);
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0,
      H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    // symbol: a faceted drop with an inner orbit (essence + gravity)
    const S = Math.min(W, H) * 0.16;
    const sym: { x: number; y: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const t = (i / 70) * Math.PI * 2;
      // teardrop curve
      const x = Math.sin(t) * Math.sin(t / 2) ** 1.2 * 0.95;
      const y = -Math.cos(t) * 1.15;
      sym.push({ x: x * S, y: y * S - S * 0.1 });
    }
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      sym.push({ x: Math.cos(t) * S * 0.42, y: Math.sin(t) * S * 0.16 + S * 0.15 });
    }
    for (let i = 0; i < 14; i++) sym.push({ x: (Math.random() - 0.5) * S * 0.2, y: S * 0.15 + (Math.random() - 0.5) * S * 0.2 });
    const N = sym.length;
    const ps = sym.map((s, i) => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.max(W, H) * (0.25 + Math.random() * 0.4);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, tx: s.x, ty: s.y, born: 0.9 + (i / N) * 0.6, hue: 180 + Math.random() * 120 };
    });
    let t0 = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      wrap.style.transition = 'opacity 0.35s';
      wrap.style.opacity = '0';
      setTimeout(() => {
        wrap.remove();
        window.removeEventListener('resize', resize);
        resolve();
      }, 350);
    };
    wrap.addEventListener('pointerdown', finish);
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
    const frame = (now: number) => {
      if (done) return;
      const t = (now - t0) / 1000;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#05030f';
      g.fillRect(0, 0, W, H);
      const cx = W / 2,
        cy = H / 2 - S * 0.35;
      g.globalCompositeOperation = 'lighter';
      // 2. single light particle
      if (t > 0.35) {
        const k = Math.min(1, (t - 0.35) / 0.4);
        const pulse = 1 + Math.sin(t * 12) * 0.15;
        const r = (6 + 20 * k) * pulse * (t > 1.6 ? Math.max(0, 1 - (t - 1.6) * 2) : 1);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.3, 'rgba(127,247,255,0.6)');
        gr.addColorStop(1, 'rgba(127,247,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r * 3, 0, Math.PI * 2);
        g.fill();
      }
      // 3-5. swarm gathering into the symbol
      for (const p of ps) {
        if (t < p.born) continue;
        const k = ease((t - p.born - 0.2) / 0.9);
        const swirl = (1 - k) * 2.5;
        const ang = Math.atan2(p.y, p.x) + swirl;
        const rad = Math.hypot(p.x, p.y) * (1 - k);
        const x = cx + Math.cos(ang) * rad + p.tx * k;
        const y = cy + Math.sin(ang) * rad + p.ty * k;
        const a = Math.min(1, (t - p.born) * 3);
        const sz = 1.5 + (1 - k) * 2 + (t > 2.4 ? 1 : 0);
        g.fillStyle = `hsla(${p.hue + t * 40},100%,${70 + k * 20}%,${a})`;
        g.beginPath();
        g.arc(x, y, sz, 0, Math.PI * 2);
        g.fill();
      }
      // symbol glow fill
      if (t > 2.2) {
        const k = ease((t - 2.2) / 0.5);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 1.6);
        gr.addColorStop(0, `rgba(255,90,214,${0.35 * k})`);
        gr.addColorStop(0.5, `rgba(122,92,255,${0.25 * k})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(cx - S * 2, cy - S * 2, S * 4, S * 4);
      }
      g.globalCompositeOperation = 'source-over';
      // 6. wordmark
      if (t > 2.45) {
        const k = ease((t - 2.45) / 0.6);
        const fs = Math.min(W * 0.085, 64);
        g.font = `${fs}px 'Lilita One', sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const spacing = (1 - k) * 30 + 4;
        const text = 'SUPERESSENCE';
        const ty = cy + S * 1.55;
        let total = 0;
        const widths = [...text].map((ch) => g.measureText(ch).width);
        total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
        let x = W / 2 - total / 2;
        g.globalAlpha = k;
        [...text].forEach((ch, i) => {
          const w = widths[i];
          const grd = g.createLinearGradient(0, ty - fs / 2, 0, ty + fs / 2);
          grd.addColorStop(0, '#ffffff');
          grd.addColorStop(1, '#bfa8ff');
          g.fillStyle = grd;
          g.fillText(ch, x + w / 2, ty);
          x += w + spacing;
        });
        // 7. energy sweep across the logo
        if (t > 3.0 && t < 3.7) {
          const sk = (t - 3.0) / 0.7;
          const sx = W / 2 - total / 2 - 80 + (total + 160) * sk;
          g.globalCompositeOperation = 'lighter';
          const sg = g.createLinearGradient(sx - 60, 0, sx + 60, 0);
          sg.addColorStop(0, 'rgba(127,247,255,0)');
          sg.addColorStop(0.5, 'rgba(127,247,255,0.9)');
          sg.addColorStop(1, 'rgba(127,247,255,0)');
          g.fillStyle = sg;
          g.fillRect(sx - 60, ty - fs * 0.7, 120, fs * 1.4);
          g.globalCompositeOperation = 'source-over';
        }
        g.globalAlpha = k * 0.7;
        g.font = `${Math.max(11, fs * 0.22)}px 'Nunito', sans-serif`;
        g.fillStyle = '#bfa8ff';
        g.fillText('S T U D I O', W / 2, ty + fs * 0.85);
        g.globalAlpha = 1;
      }
      // 8. flash
      if (t > 3.75) {
        const k = Math.max(0, 1 - (t - 3.75) / 0.45);
        g.fillStyle = `rgba(255,255,255,${k})`;
        g.fillRect(0, 0, W, H);
      }
      if (t > 4.15) return finish();
      requestAnimationFrame(frame);
    };
    const begin = () => {
      t0 = performance.now();
      requestAnimationFrame(frame);
    };
    // make sure the wordmark font is ready (bundled locally, works offline)
    Promise.race([document.fonts?.load("40px 'Lilita One'"), new Promise((r) => setTimeout(r, 600))]).then(begin, begin);
  });
}
