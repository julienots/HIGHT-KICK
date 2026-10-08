import { fmtNum } from '../core/time';
import { playerXpForLevel, rankFor } from '../data/economy';
import type { App } from './app';
import { btn, h } from './dom';
import { portraits } from './portraits';

/** Top bar: player badge (level/xp), trophies, coins, gems, energy. */
export function topBar(app: App, opts: { back?: boolean; title?: string } = {}) {
  const s = app.meta.state;
  const trophies = app.meta.progression.totalTrophies();
  const rank = rankFor(trophies);
  const av = portraits.jacker(s.profile.avatar);
  const bar = h(
    'div',
    { class: 'topbar' },
    opts.back ? btn('⬅', 'white iconbtn back', () => app.back()) : null,
    opts.title
      ? h('h1', { class: 'stroke-l', style: 'margin:0;font-size:28px;font-family:Lilita One;font-weight:400' }, opts.title)
      : h(
          'div',
          { class: 'pbadge panel dark', onclick: () => app.go('profile') },
          h('div', { class: 'avatar' }, av),
          h(
            'div',
            { class: 'col', style: 'gap:2px' },
            h('div', { class: 'f-title stroke', style: 'font-size:16px' }, s.profile.name),
            h('div', { class: 'row', style: 'gap:6px' }, h('div', { class: 'lvlstar stroke' }, String(s.level)), h('div', { class: 'xpbar' }, h('i', { style: `width:${(s.xp / playerXpForLevel(s.level)) * 100}%` }))),
          ),
        ),
    h('div', { class: 'spacer' }),
    h('div', { class: 'pill', title: rank.name, onclick: () => app.go('profile', { tab: 'road' }) }, h('span', { class: 'ic' }, '🏆'), fmtNum(trophies), h('span', { class: 'chip', style: `background:${rank.color};font-size:11px;padding:0 5px` }, rank.icon)),
    h('div', { class: 'pill', onclick: () => app.go('shop', { tab: 'bundles' }) }, h('span', { class: 'ic' }, '🪙'), fmtNum(s.currencies.coins), h('span', { class: 'plus' }, '+')),
    h('div', { class: 'pill', onclick: () => app.go('shop', { tab: 'featured' }) }, h('span', { class: 'ic' }, '💎'), fmtNum(s.currencies.gems), h('span', { class: 'plus' }, '+')),
    h('div', { class: 'pill', onclick: () => app.go('beasts') }, h('span', { class: 'ic' }, '⭐'), fmtNum(s.currencies.energy)),
  );
  return bar;
}

export function screenWithTabs(app: App, title: string, tabs: { id: string; label: string; badge?: number }[], current: string, onTab: (id: string) => void, body: HTMLElement) {
  const el = h('div', { class: 'screen bg' });
  const head = h('div', { class: 'screen-head' }, btn('⬅', 'white iconbtn back', () => app.back()), h('h1', { class: 'stroke-l' }, title), topBarMini(app));
  el.appendChild(head);
  if (tabs.length > 1)
    el.appendChild(
      h(
        'div',
        { class: 'tabs' },
        tabs.map((t) =>
          h(
            'div',
            {
              class: 'tab' + (t.id === current ? ' on' : ''),
              onclick: () => {
                onTab(t.id);
              },
            },
            t.label,
            t.badge ? h('span', { class: 'badge', style: 'position:absolute;top:-8px;right:-8px;background:#e0233f;border:2px solid #1b1035;border-radius:10px;padding:0 5px;font-size:11px' }, String(t.badge)) : null,
          ),
        ),
      ),
    );
  el.appendChild(body);
  return el;
}

export function topBarMini(app: App) {
  const s = app.meta.state;
  return h(
    'div',
    { class: 'row', style: 'gap:8px' },
    h('div', { class: 'pill' }, h('span', { class: 'ic' }, '🪙'), fmtNum(s.currencies.coins)),
    h('div', { class: 'pill' }, h('span', { class: 'ic' }, '💎'), fmtNum(s.currencies.gems)),
    h('div', { class: 'pill' }, h('span', { class: 'ic' }, '⭐'), fmtNum(s.currencies.energy)),
  );
}
