import { audio } from '../audio/audio';
import type { GrantedItem } from '../systems/ctx';

type Attrs = Record<string, any> & { class?: string; style?: string; onclick?: (e: MouseEvent) => void };
/** Tiny hyperscript helper. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Node | string | null | undefined | false | (Node | string | null | undefined | false)[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs)
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, String(v));
    }
  const add = (c: any) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  };
  children.forEach(add);
  return el;
}

/** Supercell-style chunky button with click sound. */
export function btn(label: string | Node, cls = '', onClick?: () => void, attrs: Attrs = {}) {
  const b = h('button', { class: 'btn ' + cls, ...attrs }, label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    audio.sfx(cls.includes('back') ? 'back' : 'click');
    onClick?.();
  });
  return b;
}

export function toast(text: string, icon = '', color?: string) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const t = h('div', { class: 'toast', style: color ? `background: linear-gradient(${color}, #241a55)` : '' }, (icon ? icon + ' ' : '') + text);
  host.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

export function modal(content: HTMLElement, opts: { onClose?: () => void; closable?: boolean; cls?: string } = {}) {
  const ui = document.getElementById('ui')!;
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal panel ' + (opts.cls ?? '') }, content);
  back.appendChild(box);
  const close = () => {
    back.remove();
    opts.onClose?.();
  };
  if (opts.closable !== false)
    back.addEventListener('click', (e) => {
      if (e.target === back) {
        audio.sfx('back');
        close();
      }
    });
  ui.appendChild(back);
  return { close, box };
}

export function confirmModal(title: string, text: string, okLabel: string, onOk: () => void, cls = 'green') {
  const m = modal(
    h('div', { class: 'col center' }, h('h2', { class: 'stroke' }, title), h('p', { class: 'muted', style: 'text-align:center' }, text), h('div', { class: 'row center' }, btn('ANNULER', 'gray back', () => m.close()), btn(okLabel, cls, () => (m.close(), onOk())))),
  );
  return m;
}

export function rewardItems(items: GrantedItem[]) {
  return h(
    'div',
    { class: 'reward-grid' },
    items.map((it, i) =>
      h(
        'div',
        { class: 'ritem', style: `--rc1:${it.color};--rc2:#2c1d66;animation-delay:${i * 0.08}s` },
        it.isNew ? h('div', { class: 'new' }, 'NOUVEAU') : null,
        h('div', { class: 'ri' }, it.icon),
        h('div', { class: 'rl' }, it.label),
      ),
    ),
  );
}

export function showRewards(title: string, items: GrantedItem[], onClose?: () => void) {
  if (!items.length) return;
  audio.sfx('buy');
  const m = modal(h('div', { class: 'col center' }, h('h2', { class: 'stroke' }, title), rewardItems(items), h('div', { style: 'height:8px' }), btn('SUPER !', 'green', () => m.close())), { onClose });
}

export function bar(value: number, max: number, label?: string, c1?: string, c2?: string) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return h('div', { class: 'bar', style: c1 ? `--b1:${c1};--b2:${c2 ?? c1}` : '' }, h('i', { style: `width:${pct}%` }), label ? h('span', null, label) : null);
}

export function chip(text: string, bg: string, color = '#fff') {
  return h('span', { class: 'chip', style: `background:${bg};color:${color}` }, text);
}
