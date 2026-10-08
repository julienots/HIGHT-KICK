import { audio } from '../audio/audio';
import { CHESTS, type ChestId } from '../data/economy';
import { getBeast } from '../data/beasts';
import { MODE_MAP } from '../data/modes';
import type { Unit } from '../sim/entities';
import type { World } from '../sim/world';
import type { MatchRewards } from '../systems/progression';
import type { GrantedItem } from '../systems/ctx';
import type { App, PlayOpts, Screen } from './app';
import { btn, h, rewardItems } from './dom';
import { portraits } from './portraits';

export function ResultsScreen(app: App, d: { world: World; outcome: 'win' | 'loss' | 'draw'; rewards: MatchRewards & { eventReward: GrantedItem[] | null }; stars: number; mvp: Unit | null; opts: PlayOpts }): Screen {
  const w = d.world;
  const p = w.player!;
  const title = d.outcome === 'win' ? 'VICTOIRE !' : d.outcome === 'loss' ? 'DÉFAITE' : 'ÉGALITÉ';
  const color = d.outcome === 'win' ? '#ffd23a' : d.outcome === 'loss' ? '#ff6a7a' : '#bfe6ff';
  const r = d.rewards;
  const teamRow = (team: number) =>
    h(
      'div',
      { class: 'res-team' },
      w.units
        .filter((u) => u.team === team)
        .map((u) =>
          h(
            'div',
            { class: 'res-unit panel ' + (team === p.team ? '' : 'dark') + (d.mvp === u ? ' mvp' : '') },
            d.mvp === u ? h('div', { class: 'chip', style: 'background:#ffd23a;color:#1b1035;-webkit-text-stroke:0' }, '⭐ MVP') : null,
            h('div', { style: 'height:64px' }, (() => {
              const img = portraits.jacker(u.def.id, u.skin, team === w.winner ? 'victory' : 'idle');
              img.style.cssText = 'height:64px;width:64px;object-fit:contain';
              return img;
            })()),
            h('div', { class: 'rn stroke' }, u.name + (u === p ? ' (toi)' : '')),
            h('div', { class: 'small' }, `${u.def.name} · Nv ${u.level}`),
            h('div', { class: 'small' }, `💥${u.stats.kills} 💀${u.stats.deaths} 🥚${u.stats.points}`),
          ),
        ),
    );
  const items: GrantedItem[] = [];
  if (!d.opts.campaignLevel) items.push({ reward: { type: 'xp', amount: 0 }, label: `${r.trophies >= 0 ? '+' : ''}${r.trophies}`, icon: '🏆', color: r.trophies >= 0 ? '#ffb300' : '#7a8099' });
  items.push({ reward: { type: 'coins', amount: r.coins }, label: `+${r.coins}`, icon: '🪙', color: '#ffd23a' });
  items.push({ reward: { type: 'xp', amount: r.xp }, label: `+${r.xp} XP`, icon: '📈', color: '#38c8ff' });
  items.push({ reward: { type: 'passXp', amount: r.passXp }, label: `+${r.passXp} PASS`, icon: '🎟️', color: '#c45cff' });
  if (r.chest) items.push({ reward: { type: 'chest', chestId: r.chest as ChestId }, label: CHESTS[r.chest as ChestId].name, icon: '🎁', color: CHESTS[r.chest as ChestId].color, isNew: true });
  if (r.egg) items.push({ reward: { type: 'egg', rarity: 'common' }, label: `Œuf ${getBeast(r.egg).name}`, icon: '🥚', color: '#4dff7a', isNew: true });
  if (r.firstClear) items.push({ reward: r.firstClear, label: 'Premier succès', icon: '🎖️', color: '#ff9a3a', isNew: true });
  if (d.rewards.eventReward) items.push(...d.rewards.eventReward);
  const el = h(
    'div',
    { class: 'results' },
    h(
      'div',
      { class: 'col center' },
      h('div', { class: 'res-title stroke-l', style: `color:${color}` }, title),
      h('div', { class: 'f-title stroke', style: 'font-size:20px' }, `${MODE_MAP[w.cfg.mode].icon} ${MODE_MAP[w.cfg.mode].name} · ${w.arena.name} · ${w.score[p.team]} - ${w.score[1 - p.team]}`),
      d.opts.campaignLevel ? h('div', { class: 'f-title', style: 'font-size:34px' }, '★'.repeat(d.stars) + '☆'.repeat(3 - d.stars)) : null,
      r.levelUp ? h('div', { class: 'chip', style: 'background:#ffb300' }, `⭐ NIVEAU ${r.levelUp} !`) : null,
    ),
    h('div', { class: 'res-row' }, teamRow(p.team), w.units.some((u) => u.team !== p.team) ? teamRow(1 - p.team) : null),
    rewardItems(items),
    h(
      'div',
      { class: 'row center' },
      btn('🏠 CONTINUER', 'blue big', () => {
        el.remove();
        app.quitMatch();
      }),
      btn('🔁 REJOUER', 'green big', () => {
        el.remove();
        const opts = d.opts;
        app.quitMatch();
        if (opts.campaignLevel) app.go('events', { tab: 'campaign' });
        else app.play(opts);
      }),
    ),
  );
  return {
    el,
    mount() {
      if (d.outcome === 'win') setTimeout(() => audio.sfx('coin'), 400);
    },
  };
}
