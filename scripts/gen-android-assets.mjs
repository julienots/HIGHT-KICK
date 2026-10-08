/**
 * Generates Android launcher icons and splash screens from the original BEAST GRAVITY art
 * (public/icon.svg) using headless Chromium. Run: node scripts/gen-android-assets.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android/app/src/main/res');
const svg = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2')).toString('base64');
const launchArgs = process.env.PW_ARGS ? process.env.PW_ARGS.split(' ') : [];

const browser = await chromium.launch({ args: launchArgs });
const page = await browser.newPage();

async function shot(html, w, h, out, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: 'Lilita One'; src: url('${font}') format('woff2'); }
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : '#05030f'}}
  </style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: transparent });
}

const iconSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(iconSizes)) {
  const dir = path.join(res, 'mipmap-' + d);
  const img = `<div style="width:${s}px;height:${s}px">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`;
  await shot(img, s, s, path.join(dir, 'ic_launcher.png'), true);
  const round = `<div style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `).replace('rx="110"', 'rx="256"')}</div>`;
  await shot(round, s, s, path.join(dir, 'ic_launcher_round.png'), true);
  const fg = Math.round(s * 2.25);
  const inner = Math.round(fg * 0.62);
  const fgSvg = svg.replace('<rect width="512" height="512" rx="110" fill="url(#bg)"/>', '').replace('<svg ', `<svg width="${inner}" height="${inner}" `);
  await shot(`<div style="width:${fg}px;height:${fg}px;display:flex;align-items:center;justify-content:center">${fgSvg}</div>`, fg, fg, path.join(dir, 'ic_launcher_foreground.png'), true);
}
fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2A1A7A</color>\n</resources>\n`);

const splash = (w, h) => {
  const m = Math.min(w, h);
  return `<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%, #3a2aa8 0%, #140c33 55%, #05030f 100%);font-family:'Lilita One'">
    <div style="font-size:${m * 0.2}px;line-height:.9;color:#ffc933;-webkit-text-stroke:${m * 0.012}px #1b1035;paint-order:stroke fill;transform:rotate(-3deg)">BEAST</div>
    <div style="font-size:${m * 0.16}px;line-height:.95;color:#38c8ff;-webkit-text-stroke:${m * 0.012}px #1b1035;paint-order:stroke fill;transform:rotate(-3deg)">GRAVITY</div>
    <div style="margin-top:${m * 0.04}px;font-size:${m * 0.035}px;letter-spacing:${m * 0.012}px;color:#bfa8ff">SUPERESSENCE</div></div>`;
};
const splashSizes = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };
for (const [d, [w, h]] of Object.entries(splashSizes)) {
  await shot(splash(w, h), w, h, path.join(res, `drawable-land-${d}/splash.png`));
  await shot(splash(h, w), h, w, path.join(res, `drawable-port-${d}/splash.png`));
}
await shot(splash(480, 320), 480, 320, path.join(res, 'drawable/splash.png'));
await browser.close();
console.log('Android icons & splash generated.');
