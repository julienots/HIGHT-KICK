import { audio } from '../audio/audio';
import { JACKERS } from '../data/jackers';
import { ARENAS } from '../data/arenas';
import { rankFor } from '../data/economy';
import { MODES } from '../data/modes';
import { fmtNum } from '../core/time';
import { TROPHY_ROAD } from '../systems/progression';
import type { App, Screen } from './app';
import { btn, chip, h, modal, showRewards, toast } from './dom';
import { screenWithTabs } from './common';
import { portraits } from './portraits';
import { rewardVisual } from './pass';

export function ProfileScreen(app: App, params?: { tab?: string }): Screen {
  let tab = params?.tab ?? 'profile';
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    const body = h('div', { class: 'screen-body' });
    body.appendChild(tab === 'road' ? roadTab(app, render) : profileTab(app, render));
    wrap.innerHTML = '';
    const claimable = TROPHY_ROAD.filter((st, i) => !app.meta.state.trophyRoad.includes(i) && app.meta.progression.totalTrophies() >= st.trophies).length;
    wrap.appendChild(
      screenWithTabs(
        app,
        'PROFIL',
        [
          { id: 'profile', label: '👤 PROFIL' },
          { id: 'road', label: '🏆 ROUTE DES TROPHÉES', badge: claimable },
        ],
        tab,
        (t) => ((tab = t), render()),
        body,
      ),
    );
    if (tab === 'road')
      requestAnimationFrame(() => {
        const r = body.querySelector('.road') as HTMLElement;
        const cur = body.querySelector('.roadstep.claimable, .roadstep.next') as HTMLElement | null;
        if (r && cur) r.scrollLeft = cur.offsetLeft - 80;
      });
  };
  render();
  return { el: wrap, menu3d: false, refresh: render };
}

function profileTab(app: App, rerender: () => void) {
  const s = app.meta.state;
  const st = s.stats;
  const trophies = app.meta.progression.totalTrophies();
  const rank = rankFor(trophies);
  const fav = JACKERS.slice().sort((a, b) => s.jackers[b.id].matches - s.jackers[a.id].matches)[0];
  const av = portraits.jacker(s.profile.avatar, s.jackers[s.profile.avatar].skin, 'victory');
  av.style.cssText = 'width:120px;height:120px;object-fit:contain';
  const stat = (icon: string, label: string, v: number | string) => h('div', { class: 'pstat' }, `${icon} ${label}`, h('b', { class: 'stroke' }, typeof v === 'number' ? fmtNum(v) : v));
  return h(
    'div',
    { class: 'col' },
    h(
      'div',
      { class: 'panel', style: 'padding:12px' },
      h(
        'div',
        { class: 'row wrap' },
        h('div', { class: 'avatar', style: 'width:120px;height:120px;cursor:pointer', onclick: () => pickAvatar(app, rerender) }, av),
        h(
          'div',
          { class: 'col', style: 'flex:1;min-width:200px;gap:4px' },
          h('div', { class: 'row' }, h('div', { class: 'f-title stroke-l', style: 'font-size:30px' }, s.profile.name), btn('✏️', 'white iconbtn small', () => editName(app, rerender))),
          h('div', { class: 'row wrap' }, chip(`« ${s.profile.title} »`, '#8a35e0'), btn('TITRE', 'blue small', () => pickTitle(app, rerender))),
          h('div', { class: 'row wrap' }, chip(`⭐ Niveau ${s.level}`, '#1f7cf2'), chip(`${rank.icon} ${rank.name}`, rank.color, '#1b1035'), chip(`🏆 ${trophies}`, '#ffb300')),
          h('div', { class: 'row wrap' }, h('span', { class: 'small stroke' }, 'Badges : '), s.profile.badges.length ? s.profile.badges.map((b) => h('span', { style: 'font-size:22px' }, b)) : h('span', { class: 'small muted' }, 'Complète des succès pour en gagner')),
        ),
      ),
    ),
    h('div', { class: 'section-title stroke' }, 'STATISTIQUES'),
    h(
      'div',
      { class: 'profile-grid' },
      stat('🎮', 'Matchs', st.matches ?? 0),
      stat('🏆', 'Victoires', st.wins ?? 0),
      stat('💔', 'Défaites', st.losses ?? 0),
      stat('📊', 'Ratio', st.matches ? `${Math.round(((st.wins ?? 0) / st.matches) * 100)}%` : '—'),
      stat('💥', 'Éliminations', st.kills ?? 0),
      stat('🥚', 'Œufs livrés', st.eggsDelivered ?? 0),
      stat('👑', 'Titans livrés', st.titansDelivered ?? 0),
      stat('🧲', 'Nodes activés', st.nodesActivated ?? 0),
      stat('⭐', 'MVP', st.mvp ?? 0),
      stat('🐾', 'Créatures', s.beasts.length),
      stat('📖', 'Espèces', new Set(s.beasts.map((b) => b.speciesId)).size),
      stat('🎨', 'Skins', app.meta.progression.stat('skinsOwned')),
      stat('🧑‍🚀', 'Jackers', app.meta.progression.stat('jackersOwned')),
      stat('🎁', 'Coffres ouverts', st.chestsOpened ?? 0),
      stat('🔥', 'Série de connexion', s.streak),
      stat('❤️', 'Jacker favori', fav.name),
    ),
    h('div', { class: 'section-title stroke' }, 'VICTOIRES PAR MODE'),
    h('div', { class: 'row wrap' }, MODES.map((m) => chip(`${m.icon} ${m.name} : ${st['wins_' + m.id] ?? 0}`, m.color))),
  );
}

function pickAvatar(app: App, rerender: () => void) {
  const s = app.meta.state;
  const m = modal(
    h(
      'div',
      { class: 'col' },
      h('h2', { class: 'stroke' }, 'AVATAR'),
      h(
        'div',
        { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(80px,1fr))' },
        JACKERS.filter((j) => s.jackers[j.id].unlocked).map((j) =>
          h('div', { class: 'card', onclick: () => ((s.profile.avatar = j.id), app.meta.dirty(), m.close(), rerender()) }, h('div', { class: 'portrait' }, portraits.jacker(j.id, s.jackers[j.id].skin)), h('div', { class: 'cname', style: 'font-size:11px' }, j.name)),
        ),
      ),
    ),
  );
}
function pickTitle(app: App, rerender: () => void) {
  const s = app.meta.state;
  const m = modal(h('div', { class: 'col' }, h('h2', { class: 'stroke' }, 'TITRE'), h('div', { class: 'row wrap center' }, s.profile.titles.map((t) => btn(t, t === s.profile.title ? '' : 'white small', () => ((s.profile.title = t), app.meta.dirty(), m.close(), rerender()))))));
}
function editName(app: App, rerender: () => void) {
  const s = app.meta.state;
  const input = h('input', { type: 'text', maxlength: '16', value: s.profile.name }) as HTMLInputElement;
  const m = modal(
    h(
      'div',
      { class: 'col' },
      h('h2', { class: 'stroke' }, 'NOM DE JOUEUR'),
      input,
      btn('VALIDER', 'green', () => {
        const v = input.value.replace(/[<>]/g, '').trim().slice(0, 16);
        if (v.length < 2) return toast('2 caractères minimum', '⚠️');
        s.profile.name = v;
        app.meta.dirty();
        m.close();
        rerender();
      }),
    ),
  );
  setTimeout(() => input.focus(), 50);
}

function roadTab(app: App, rerender: () => void) {
  const s = app.meta.state;
  const total = app.meta.progression.totalTrophies();
  let nextMarked = false;
  return h(
    'div',
    { class: 'col' },
    h('div', { class: 'f-title stroke', style: 'font-size:20px' }, `🏆 ${total} trophées — gagne des matchs pour avancer et débloquer Jackers, arènes et coffres.`),
    h(
      'div',
      { class: 'road' },
      TROPHY_ROAD.map((step, i) => {
        const claimed = s.trophyRoad.includes(i);
        const reached = total >= step.trophies;
        const v = rewardVisual(step.reward);
        let cls = claimed ? ' claimed' : reached ? ' claimable' : '';
        if (!reached && !nextMarked) {
          nextMarked = true;
          cls += ' next';
        }
        return h(
          'div',
          {
            class: 'roadstep panel' + cls,
            style: reached ? '' : 'filter:grayscale(.6)',
            onclick: () => {
              if (claimed || !reached) return;
              const items = app.meta.progression.claimTrophyRoad(i);
              if (items) {
                audio.sfx('levelUp');
                showRewards('ROUTE DES TROPHÉES', items, rerender);
              }
            },
          },
          h('div', { class: 'rt stroke' }, `🏆 ${step.trophies}`),
          h('div', { class: 'ri' }, step.reward.type === 'jacker' ? (() => {
            const img = portraits.jacker(step.reward.jackerId);
            img.style.cssText = 'width:60px;height:60px;object-fit:contain';
            return img;
          })() : v.icon),
          h('div', { class: 'small stroke' }, v.label),
          claimed ? h('div', null, '✔') : null,
        );
      }),
    ),
    h('div', { class: 'section-title stroke' }, 'ARÈNES'),
    h('div', { class: 'row wrap' }, ARENAS.map((a) => chip(`${total >= a.unlockTrophies ? '✅' : '🔒'} ${a.name} · ${a.unlockTrophies}🏆`, total >= a.unlockTrophies ? a.theme.wallSide : '#3a2d7a'))),
  );
}
