import { audio } from '../audio/audio';
import { QUEST_KIND_INFO, type QuestKind } from '../data/quests';
import type { App, Screen } from './app';
import { bar, btn, h, showRewards } from './dom';
import { screenWithTabs } from './common';
import { rewardVisual } from './pass';

export function QuestsScreen(app: App, params?: { tab?: string }): Screen {
  let tab = params?.tab ?? 'daily';
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    app.meta.quests.refresh();
    const body = h('div', { class: 'screen-body' });
    if (tab === 'achievements') {
      const list = app.meta.achievements.list().sort((a, b) => Number(b.done && !b.claimed) - Number(a.done && !a.claimed) || Number(a.claimed) - Number(b.claimed));
      body.appendChild(h('div', { class: 'f-title stroke', style: 'margin-bottom:8px' }, `🏅 ${list.filter((a) => a.claimed).length} / ${list.length} succès`));
      body.appendChild(
        h(
          'div',
          { class: 'col' },
          list.map((a) =>
            h(
              'div',
              { class: 'ach panel ' + (a.claimed ? 'dark' : ''), style: a.claimed ? 'opacity:.6' : '' },
              h('div', { class: 'icn' }, a.def.icon),
              h('div', null, h('div', { class: 'f-title stroke' }, a.def.name), h('div', { class: 'small' }, a.def.desc), bar(a.progress, a.def.target, `${a.progress} / ${a.def.target}`)),
              a.claimed
                ? h('div', { class: 'f-title' }, '✔')
                : a.done
                  ? btn('RÉCLAMER', 'green small', () => {
                      const items = app.meta.achievements.claim(a.def.id);
                      if (items) {
                        audio.sfx('levelUp');
                        render();
                      }
                    })
                  : h('div', { class: 'small' }, a.def.reward.map((r) => `${rewardVisual(r).icon}${rewardVisual(r).label}`).join(' ')),
            ),
          ),
        ),
      );
    } else {
      const kind = tab as QuestKind;
      const info = QUEST_KIND_INFO[kind];
      const list = app.meta.quests.list(kind);
      body.appendChild(h('div', { class: 'small muted', style: 'margin-bottom:8px' }, kind === 'daily' || kind === 'combat' ? 'Renouvelées chaque jour (horloge de l’appareil, hors ligne).' : kind === 'season' ? 'Valables toute la saison.' : 'Renouvelées chaque semaine.'));
      body.appendChild(
        h(
          'div',
          { class: 'col' },
          list.map((q) =>
            h(
              'div',
              { class: 'quest panel', style: `--panel1:${info.color};--panel2:#2c1d66;${q.entry.claimed ? 'opacity:.55' : ''}` },
              h('div', { class: 'col', style: 'gap:4px' }, h('div', { class: 'f-title stroke' }, `${info.icon} ${q.tpl.text}`), bar(q.progress, q.tpl.target, `${Math.floor(q.progress)} / ${q.tpl.target}`), h('div', { class: 'small' }, '🎁 ' + q.tpl.reward.map((r) => `${typeof rewardVisual(r).icon === 'string' ? rewardVisual(r).icon : '🎁'} ${rewardVisual(r).label}`).join(' · ') + ` · 🎟️ ${q.tpl.passXp}`)),
              q.entry.claimed
                ? h('div', { class: 'f-title', style: 'font-size:26px' }, '✔')
                : q.done
                  ? btn('RÉCLAMER', 'green', () => {
                      const items = app.meta.quests.claim(kind, q.entry.tid);
                      if (items) showRewards('MISSION ACCOMPLIE !', items, render);
                    })
                  : btn('JOUER', 'blue small', () => app.play({ mode: app.selectedMode, arena: app.selectedArena })),
            ),
          ),
        ),
      );
    }
    const tabs: { id: string; label: string; badge: number }[] = (Object.keys(QUEST_KIND_INFO) as QuestKind[]).map((k) => ({ id: k as string, label: `${QUEST_KIND_INFO[k].icon} ${QUEST_KIND_INFO[k].name}`, badge: app.meta.quests.list(k).filter((q) => q.done && !q.entry.claimed).length }));
    tabs.push({ id: 'achievements', label: '🏅 SUCCÈS', badge: app.meta.achievements.claimable() });
    wrap.innerHTML = '';
    wrap.appendChild(screenWithTabs(app, 'MISSIONS', tabs, tab, (t) => ((tab = t), render()), body));
  };
  render();
  return { el: wrap, menu3d: false, refresh: render };
}
