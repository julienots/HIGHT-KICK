import { audio } from '../audio/audio';
import { getJacker } from '../data/jackers';
import { fmtNum } from '../core/time';
import { CLUB_CHEST_TIERS } from '../systems/renaissance';
import type { App, Screen } from './app';
import { bar, btn, chip, confirmModal, h, modal, showRewards, toast } from './dom';
import { screenWithTabs } from './common';
import { portraits } from './portraits';

const BADGES = ['🛡️', '🐲', '🥚', '🌀', '🪶', '⚡', '🔥', '❄️', '👑', '🌟', '🐾', '🌑'];

export function ClubScreen(app: App, params?: { tab?: string }): Screen {
  let tab = params?.tab ?? 'club';
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    app.meta.club.sync();
    const s = app.meta.state;
    const body = h('div', { class: 'screen-body' });
    if (!s.club) body.appendChild(joinView(app, render));
    else if (tab === 'league') body.appendChild(leagueView(app));
    else body.appendChild(clubView(app, render));
    wrap.innerHTML = '';
    wrap.appendChild(
      screenWithTabs(
        app,
        'CLUB',
        s.club
          ? [
              { id: 'club', label: `${s.club.badge} ${s.club.name.toUpperCase()}` },
              { id: 'league', label: '🏆 LIGUE DES CLUBS' },
            ]
          : [],
        tab,
        (t) => ((tab = t), render()),
        body,
      ),
    );
  };
  render();
  return { el: wrap, menu3d: false, refresh: render };
}

function joinView(app: App, rerender: () => void) {
  const offers = app.meta.club.offers();
  return h(
    'div',
    { class: 'col' },
    h('div', { class: 'small muted' }, 'Rejoins un club pour gagner des coffres de club chaque semaine. Tes coéquipiers jouent aussi quand tu n’es pas là (hors ligne).'),
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(240px,1fr))' },
      offers.map((o) =>
        h(
          'div',
          { class: 'panel', style: `padding:12px;--panel1:${o.color};--panel2:#2c1d66` },
          h('div', { class: 'row' }, h('div', { style: 'font-size:44px' }, o.badge), h('div', { class: 'col', style: 'gap:2px' }, h('div', { class: 'f-title stroke-l', style: 'font-size:22px' }, o.name), h('div', { class: 'small stroke' }, `👥 ${o.members.length}/30 · 🏆 ${fmtNum(o.trophies)}`))),
          h('div', { class: 'small stroke', style: 'margin:6px 0' }, `Trophées requis : ${o.required}`),
          btn('REJOINDRE', 'green', () => {
            app.meta.club.join(o);
            audio.sfx('levelUp');
            toast(`Bienvenue dans ${o.name} !`, o.badge, o.color);
            rerender();
          }),
        ),
      ),
    ),
    btn('➕ CRÉER MON CLUB', 'blue', () => {
      const input = h('input', { type: 'text', maxlength: '20', placeholder: 'Nom du club' }) as HTMLInputElement;
      let badge = BADGES[0];
      const row = h('div', { class: 'row wrap center' });
      const draw = () => {
        row.innerHTML = '';
        BADGES.forEach((b) => row.appendChild(btn(b, b === badge ? 'iconbtn' : 'white iconbtn', () => ((badge = b), draw()))));
      };
      draw();
      const m = modal(
        h(
          'div',
          { class: 'col' },
          h('h2', { class: 'stroke' }, 'CRÉER UN CLUB'),
          input,
          row,
          btn('CRÉER', 'green', () => {
            const n = input.value.replace(/[<>]/g, '').trim();
            if (n.length < 3) return toast('3 caractères minimum', '⚠️');
            app.meta.club.create(n, badge);
            m.close();
            rerender();
          }),
        ),
      );
    }),
  );
}

function clubView(app: App, rerender: () => void) {
  const cl = app.meta.state.club!;
  const total = app.meta.club.total();
  const me = { name: app.meta.state.profile.name, jacker: app.meta.state.profile.selectedJacker, trophies: app.meta.progression.totalTrophies(), role: 'membre' as const, me: true };
  const members = [...cl.members.map((m) => ({ ...m, me: false })), me].sort((a, b) => b.trophies - a.trophies);
  const tierBox = CLUB_CHEST_TIERS.map((t, i) => {
    const got = cl.claimed.includes(i);
    const can = total >= t && !got;
    return h(
      'div',
      { class: 'passcell' + (can ? ' claim' : '') + (got ? ' done' : ''), style: 'min-width:90px', onclick: () => can && (() => { const it = app.meta.club.claim(i); if (it) showRewards('COFFRE DE CLUB', it, rerender); })() },
      h('div', { class: 'pi' }, ['🎁', '🎁', '🎁', '🐾', '💎'][i]),
      h('div', { class: 'small stroke' }, `NIV. ${i + 1}`),
      h('div', { class: 'small' }, `${fmtNum(t)} pts`),
    );
  });
  return h(
    'div',
    { class: 'col' },
    h(
      'div',
      { class: 'panel', style: `padding:12px;--panel1:${cl.color};--panel2:#2c1d66` },
      h('div', { class: 'row wrap' }, h('div', { style: 'font-size:54px' }, cl.badge), h('div', { class: 'col', style: 'gap:2px;flex:1' }, h('div', { class: 'f-title stroke-l', style: 'font-size:26px' }, cl.name), h('div', { class: 'small stroke' }, `👥 ${members.length} membres · points de la semaine : ${fmtNum(total)} (toi : ${fmtNum(cl.weekPoints)})`)), btn('QUITTER', 'red small', () => confirmModal('Quitter le club ?', 'Tes points de la semaine seront perdus.', 'QUITTER', () => (app.meta.club.leave(), rerender()), 'red'))),
      h('div', { style: 'margin-top:8px' }, bar(total, CLUB_CHEST_TIERS[CLUB_CHEST_TIERS.length - 1], `Coffre de club : ${fmtNum(total)} / ${fmtNum(CLUB_CHEST_TIERS[CLUB_CHEST_TIERS.length - 1])}`, '#ffe760', '#ffb300')),
      h('div', { class: 'skinrow', style: 'margin-top:8px' }, tierBox),
    ),
    h('div', { class: 'row wrap', style: 'align-items:flex-start' },
      h(
        'div',
        { class: 'col', style: 'flex:1;min-width:260px' },
        h('div', { class: 'section-title stroke' }, 'MEMBRES'),
        members.map((m, i) => {
          const img = portraits.jacker(m.jacker);
          img.style.cssText = 'width:40px;height:40px;object-fit:contain';
          return h('div', { class: 'listitem panel ' + (m.me ? '' : 'dark'), style: 'padding:6px 10px' }, h('div', { class: 'f-title stroke', style: 'width:26px' }, String(i + 1)), img, h('div', { style: 'flex:1' }, h('div', { class: 'f-title stroke' }, m.name + (m.me ? ' (toi)' : '')), h('div', { class: 'small muted' }, `${m.role} · ${getJacker(m.jacker).name}`)), chip(`🏆 ${fmtNum(m.trophies)}`, '#ffb300', '#1b1035'));
        }),
      ),
      h(
        'div',
        { class: 'col', style: 'flex:1;min-width:240px' },
        h('div', { class: 'section-title stroke' }, '💬 DISCUSSION'),
        app.meta.club.feed().map((f) => h('div', { class: 'panel dark', style: 'padding:8px 10px' }, h('div', { class: 'small' }, h('b', { style: 'color:#ffd23a' }, f.who), ` · il y a ${f.ago}`), h('div', null, f.text))),
      ),
    ),
  );
}

function leagueView(app: App) {
  const rows = app.meta.club.league();
  return h(
    'div',
    { class: 'col' },
    h('div', { class: 'small muted' }, 'Classement hebdomadaire des clubs selon les points gagnés en match.'),
    rows.map((r, i) => h('div', { class: 'listitem panel ' + (r.me ? '' : 'dark') }, h('div', { class: 'f-title stroke', style: 'width:30px;font-size:20px' }, ['🥇', '🥈', '🥉'][i] ?? String(i + 1)), h('div', { style: 'font-size:28px' }, r.badge), h('div', { class: 'f-title stroke', style: 'flex:1' }, r.name), chip(`${fmtNum(r.points)} pts`, '#3a2d7a'))),
  );
}
