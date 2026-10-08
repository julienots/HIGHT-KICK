import { audio } from '../audio/audio';
import { ARENAS, getArena } from '../data/arenas';
import { CAMPAIGN } from '../data/campaign';
import { DIFFICULTY_INFO, MODE_MAP, type Difficulty, type ModeId } from '../data/modes';
import { RANKS } from '../data/economy';
import { seasonInfo, SEASON_THEMES } from '../data/seasons';
import { fmtDuration } from '../core/time';
import type { App, Screen } from './app';
import { btn, chip, h, toast } from './dom';
import { screenWithTabs } from './common';
import { rewardVisual } from './pass';
import { portraits } from './portraits';

export function EventsScreen(app: App, params?: { tab?: string }): Screen {
  let tab = params?.tab ?? 'events';
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    const body = h('div', { class: 'screen-body' });
    if (tab === 'events') body.appendChild(eventsTab(app));
    else if (tab === 'campaign') body.appendChild(campaignTab(app));
    else body.appendChild(seasonTab(app));
    wrap.innerHTML = '';
    wrap.appendChild(
      screenWithTabs(
        app,
        'ÉVÉNEMENTS',
        [
          { id: 'events', label: '🎉 ÉVÉNEMENTS' },
          { id: 'campaign', label: '🗺️ CAMPAGNE' },
          { id: 'season', label: '🏆 SAISON' },
        ],
        tab,
        (t) => ((tab = t), render()),
        body,
      ),
    );
  };
  render();
  return { el: wrap, menu3d: false, refresh: render };
}

function eventsTab(app: App) {
  const cur = app.meta.events.current();
  return h(
    'div',
    { class: 'col' },
    h('div', { class: 'small stroke' }, `🔄 Rotation dans ${fmtDuration(cur.ends - Date.now())} · Les événements tournent automatiquement, même hors ligne.`),
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(260px,1fr))' },
      cur.events.map((ev) => {
        const mode = MODE_MAP[ev.mode as ModeId];
        const claimed = app.meta.events.isClaimed(ev.id);
        const v = rewardVisual(ev.reward);
        return h(
          'div',
          { class: 'panel', style: `padding:14px;--panel1:${ev.color};--panel2:#2c1d66` },
          h('div', { class: 'row' }, h('div', { style: 'font-size:46px' }, ev.icon), h('div', { class: 'col', style: 'gap:2px' }, h('div', { class: 'f-title stroke-l', style: 'font-size:24px' }, ev.name), h('div', { class: 'small stroke' }, ev.desc))),
          h('div', { class: 'row wrap', style: 'margin:8px 0' }, chip(`${mode.icon} ${mode.name}`, mode.color), chip(getArena(ev.arena).name, '#3a2d7a'), chip(DIFFICULTY_INFO[ev.difficulty as Difficulty].name, DIFFICULTY_INFO[ev.difficulty as Difficulty].color, '#1b1035')),
          h('div', { class: 'row' }, h('div', { class: 'small stroke' }, 'Récompense de victoire : '), h('div', { style: 'font-size:22px' }, v.icon), h('div', { class: 'small stroke' }, v.label), claimed ? chip('✔ OBTENUE', '#37b81c') : null),
          h('div', { style: 'height:8px' }),
          btn('▶ JOUER', 'green big', () => app.play({ mode: ev.mode as ModeId, arena: ev.arena, difficulty: ev.difficulty as Difficulty, eventId: ev.id, modifiers: ev.modifier === 'none' ? [] : [ev.modifier] })),
        );
      }),
    ),
  );
}

function campaignTab(app: App) {
  const s = app.meta.state;
  const total = Object.values(s.campaign).reduce((a, b) => a + b, 0);
  const box = h('div', { class: 'col' }, h('div', { class: 'f-title stroke', style: 'font-size:18px' }, `🌟 ${total} / ${CAMPAIGN.length * 3} étoiles · 3 étoiles = victoire + écart + aucun K.O.`));
  let prevDone = true;
  for (const a of ARENAS) {
    const levels = CAMPAIGN.filter((c) => c.arena === a.id);
    box.appendChild(
      h(
        'div',
        { class: 'panel', style: `padding:12px;--panel1:${a.theme.groundA};--panel2:${a.theme.wallSide}` },
        h('div', { class: 'f-title stroke-l', style: 'font-size:20px' }, `CHAPITRE ${a.num} · ${a.name}`),
        h('div', { class: 'small stroke' }, a.desc + ' — ' + a.mechanicDesc),
        h(
          'div',
          { class: 'row wrap', style: 'margin-top:8px;gap:14px' },
          levels.map((lv) => {
            const stars = s.campaign[lv.id] ?? 0;
            const unlocked = prevDone;
            prevDone = stars > 0;
            const mode = MODE_MAP[lv.mode];
            return h(
              'div',
              { class: 'col center', style: 'gap:2px' },
              h(
                'div',
                {
                  class: 'campaign-node' + (unlocked ? '' : ' locked'),
                  style: `background:linear-gradient(${mode.color}, #2c1d66)`,
                  onclick: () => {
                    audio.sfx('click');
                    app.play({ mode: lv.mode, arena: lv.arena, difficulty: lv.difficulty, campaignLevel: lv.id });
                  },
                },
                h('div', { class: 'stroke' }, String(lv.num)),
                h('div', { class: 'stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
              ),
              h('div', { class: 'small stroke' }, `${mode.icon} ${DIFFICULTY_INFO[lv.difficulty].name}`),
            );
          }),
        ),
      ),
    );
  }
  return box;
}

function seasonTab(app: App) {
  const si = seasonInfo();
  const trophies = app.meta.progression.totalTrophies();
  return h(
    'div',
    { class: 'col' },
    h(
      'div',
      { class: 'panel', style: `padding:14px;--panel1:${si.theme.color};--panel2:${si.theme.color2}` },
      h('div', { class: 'f-title stroke-l', style: 'font-size:28px' }, `SAISON ${si.number}`),
      h('div', { class: 'f-title stroke', style: 'font-size:20px' }, si.theme.name),
      h('div', { class: 'stroke' }, si.theme.subtitle),
      h('div', { class: 'small stroke' }, `⏳ ${fmtDuration(si.remaining)} restants · Arène à l’honneur : ${getArena(si.theme.arena).name} · Mode vedette : ${MODE_MAP[si.theme.eventMode as ModeId].name}`),
      h('div', { class: 'row', style: 'margin-top:8px' }, si.theme.featuredBeasts.map((b) => {
        const img = portraits.beast(b, 3);
        img.style.cssText = 'width:80px;height:80px;object-fit:contain';
        return img;
      })),
      h('div', { class: 'small stroke' }, 'Fin de saison : les trophées au-delà de 500 par Jacker sont réduits de 40 % et convertis en coins.'),
      btn('🎟️ VOIR LE SUPER PASS', '', () => app.go('pass')),
    ),
    h('div', { class: 'section-title stroke' }, 'CLASSEMENT'),
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(140px,1fr))' },
      RANKS.map((r) => h('div', { class: 'panel', style: `padding:10px;text-align:center;--panel1:${r.color};--panel2:#2c1d66;${trophies >= r.min ? '' : 'opacity:.55'}` }, h('div', { style: 'font-size:36px' }, r.icon), h('div', { class: 'f-title stroke' }, r.name), h('div', { class: 'small stroke' }, `${r.min}+ 🏆`))),
    ),
    h('div', { class: 'section-title stroke' }, 'SAISONS À VENIR'),
    h('div', { class: 'row wrap' }, SEASON_THEMES.map((t, i) => chip(`${i === si.index % SEASON_THEMES.length ? '▶ ' : ''}${t.name}`, t.color, '#1b1035'))),
  );
}

export { toast };
