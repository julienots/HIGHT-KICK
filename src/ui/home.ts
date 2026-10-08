import { audio } from '../audio/audio';
import { getJacker, ROLE_INFO } from '../data/jackers';
import { MODE_MAP, DIFFICULTY_INFO } from '../data/modes';
import { seasonInfo } from '../data/seasons';
import { fmtDuration } from '../core/time';
import { rankFor } from '../data/economy';
import type { App, Screen } from './app';
import { btn, h } from './dom';
import { topBar } from './common';
import { openModeSelect } from './play';

export function HomeScreen(app: App): Screen {
  const el = h('div', { class: 'home' });
  const render = () => {
    el.innerHTML = '';
    const s = app.meta.state;
    const n = app.meta.notifications();
    const j = getJacker(s.profile.selectedJacker);
    const jp = s.jackers[j.id];
    app.menu.setHero(j.id, jp.skin);
    const comp = s.profile.companion ? s.beasts.find((b) => b.uid === s.profile.companion) : null;
    app.menu.setPet(comp ? comp.speciesId : s.beasts[0]?.speciesId ?? null, comp?.stage ?? 2, comp?.mutation ?? 'none');
    el.appendChild(topBar(app));
    const season = seasonInfo();
    el.appendChild(h('div', { class: 'season-banner panel dark stroke', style: `background:linear-gradient(${season.theme.color}, ${season.theme.color2})` }, `SAISON ${season.number} · ${season.theme.name} · ${fmtDuration(season.remaining)}`));
    const nav = (icon: string, label: string, go: string, c1: string, c2: string, badge = 0, params?: any) =>
      h('div', { class: 'navbtn', style: `--c1:${c1};--c2:${c2}`, onclick: () => (audio.sfx('click'), app.go(go, params)) }, h('div', { class: 'ni' }, icon), h('div', { class: 'nl' }, label), badge ? h('div', { class: 'badge' }, String(badge)) : null);
    el.appendChild(
      h(
        'div',
        { class: 'home-left' },
        nav('🛒', 'SHOP', 'shop', '#ffb36b', '#ff6a1f'),
        nav('🎟️', 'PASS', 'pass', '#d18bff', '#8a35e0', n.pass),
        nav('🎯', 'QUESTS', 'quests', '#9df55a', '#37b81c', n.quests + n.achievements),
        nav('🎉', 'EVENTS', 'events', '#ff8ad8', '#e0237a'),
      ),
    );
    el.appendChild(
      h(
        'div',
        { class: 'home-right' },
        nav('🧑‍🚀', 'JACKERS', 'jackers', '#63d6ff', '#1f7cf2'),
        nav('🐾', 'BEASTS', 'beasts', '#9df55a', '#1a8a5a', n.eggs + n.farm),
        nav('🎁', 'COFFRES', 'chests', '#ffe760', '#ff9a00', n.chests),
        nav('👤', 'PROFIL', 'profile', '#c9d6e8', '#6a7a99'),
      ),
    );
    // hero name / trophies
    const rank = rankFor(jp.trophies);
    el.appendChild(
      h(
        'div',
        { class: 'hero-info', onclick: () => (app.menu.poke(), audio.sfx('voice', j.voice)) },
        h('div', { class: 'hero-name stroke-l' }, j.name),
        h('div', { class: 'trophy-pill row' }, h('span', { class: 'chip', style: `background:${ROLE_INFO[j.role].color}` }, `${ROLE_INFO[j.role].icon} ${ROLE_INFO[j.role].name}`), h('span', { class: 'chip', style: 'background:#3a2d7a' }, `Nv ${jp.level}`), h('span', { class: 'chip', style: `background:${rank.color};color:#1b1035;-webkit-text-stroke:0` }, `🏆 ${jp.trophies}`)),
        btn('CHANGER', 'blue small', () => app.go('jackers')),
      ),
    );
    const mode = MODE_MAP[app.selectedMode];
    const diff = DIFFICULTY_INFO[s.settings.difficulty];
    el.appendChild(
      h(
        'div',
        { class: 'home-bottom' },
        h(
          'div',
          { class: 'modebox panel', onclick: () => (audio.sfx('click'), openModeSelect(app, render)) },
          h('div', { class: 'mi', style: `background:${mode.color}` }, mode.icon),
          h('div', { class: 'col', style: 'gap:0' }, h('div', { class: 'mt stroke' }, mode.name), h('div', { class: 'ms stroke' }, `${app.selectedArena === 'random' ? 'Arène aléatoire' : app.selectedArena.replace('_', ' ').toUpperCase()} · `, h('span', { style: `color:${diff.color}` }, diff.name))),
        ),
        btn('JOUER', 'playbtn', () => app.play({ mode: app.selectedMode, arena: app.selectedArena })),
      ),
    );
    el.appendChild(h('div', { class: 'home-left-bottom' }, btn('⚙️', 'white iconbtn', () => app.go('settings')), btn('🗺️', 'blue iconbtn', () => app.go('events', { tab: 'campaign' }))));
  };
  render();
  return { el, menu3d: 0, refresh: render };
}
