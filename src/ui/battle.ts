import { audio } from '../audio/audio';
import { haptics } from '../audio/haptics';
import { getBeast } from '../data/beasts';
import { ELEMENT_INFO } from '../data/elements';
import { ARENA_FLOORS, STAGE_NAMES, type BattleResult } from '../systems/renaissance';
import { beastStats } from '../systems/beasts';
import type { App } from './app';
import { btn, chip, h, rewardItems, toast } from './dom';
import { portraits } from './portraits';

/** BEAST ARENA tab: build a team of 3 creatures and climb a 30-floor tower. */
export function battleTab(app: App, rerender: () => void) {
  const s = app.meta.state;
  const b = s.battle;
  let team = b.team.filter((u) => s.beasts.some((x) => x.uid === u));
  if (!team.length)
    team = s.beasts
      .slice()
      .sort((a, c) => beastStats(c).power - beastStats(a).power)
      .slice(0, 3)
      .map((x) => x.uid);
  const floor = Math.min(b.floor, ARENA_FLOORS);
  const enemies = app.meta.battle.enemyTeam(floor);
  const box = h('div', { class: 'col' });
  const teamRow = h('div', { class: 'row wrap' });
  const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(96px,1fr))' });
  const power = h('div', { class: 'f-title stroke' });
  const fightBtn = btn('⚔️ COMBATTRE', 'red big', () => {
    if (!team.length) return toast('Choisis au moins une créature', '🐾');
    const res = app.meta.battle.fight(team);
    if (res) playBattle(app, res.result, res.items, res.floor, rerender);
  });
  const draw = () => {
    teamRow.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const be = s.beasts.find((x) => x.uid === team[i]);
      if (!be) {
        teamRow.appendChild(h('div', { class: 'incubator panel dark' }, h('div', { style: 'font-size:40px;opacity:.4' }, '➕'), h('div', { class: 'small muted' }, 'Libre')));
        continue;
      }
      const img = portraits.beast(be.speciesId, be.stage, be.mutation);
      img.style.cssText = 'width:80px;height:80px;object-fit:contain';
      teamRow.appendChild(h('div', { class: 'incubator panel', onclick: () => ((team = team.filter((u) => u !== be.uid)), draw()) }, img, h('div', { class: 'small stroke' }, `${getBeast(be.speciesId).name} · Nv ${be.level}`), chip(STAGE_NAMES[be.stage], '#3a2d7a')));
    }
    const pw = team.reduce((a, u) => a + beastStats(s.beasts.find((x) => x.uid === u)!).power, 0);
    const epw = enemies.reduce((a, f) => a + f.hp / 10 + f.atk + f.def + f.spd, 0);
    power.textContent = `⚡ Puissance : ${pw} vs ${Math.round(epw)} ${pw >= epw ? '✅' : '⚠️'}`;
    grid.innerHTML = '';
    for (const be of s.beasts.slice().sort((a, c) => beastStats(c).power - beastStats(a).power)) {
      const sp = getBeast(be.speciesId);
      const img = portraits.beast(sp.id, be.stage, be.mutation);
      const sel = team.includes(be.uid);
      grid.appendChild(
        h(
          'div',
          {
            class: 'card',
            style: `--cc1:${ELEMENT_INFO[sp.element].color};--cc2:#2c1d66;${sel ? 'outline:4px solid #ffe760' : ''}`,
            onclick: () => {
              if (sel) team = team.filter((u) => u !== be.uid);
              else if (team.length < 3) team.push(be.uid);
              else toast('3 créatures maximum', '🐾');
              audio.sfx('click');
              draw();
            },
          },
          h('div', { class: 'portrait' }, img),
          h('div', { class: 'clvl' }, chip(`${beastStats(be).power}`, '#3a2d7a')),
          h('div', { class: 'cname', style: 'font-size:12px' }, `${ELEMENT_INFO[sp.element].icon} ${sp.name}`),
        ),
      );
    }
  };
  draw();
  const reward = app.meta.battle.floorReward(floor);
  box.append(
    h(
      'div',
      { class: 'panel', style: 'padding:12px;--panel1:#ff6a7a;--panel2:#2c1d66' },
      h('div', { class: 'row wrap' }, h('div', { class: 'col', style: 'flex:1;gap:2px' }, h('div', { class: 'f-title stroke-l', style: 'font-size:26px' }, `⚔️ BEAST ARENA · ÉTAGE ${floor}/${ARENA_FLOORS}`), h('div', { class: 'small stroke' }, `Record : étage ${b.best} · Victoires aujourd’hui : ${b.winsToday}`), h('div', { class: 'small stroke' }, `Récompense du premier passage : ${reward.map((r) => ('amount' in r ? `${r.amount} ` : '') + r.type).join(' + ')}`)), fightBtn),
      h(
        'div',
        { class: 'row wrap', style: 'margin-top:8px' },
        h('div', { class: 'small stroke' }, 'ADVERSAIRES : '),
        enemies.map((f) => {
          const img = portraits.beast(f.speciesId, f.stage);
          img.style.cssText = 'width:56px;height:56px;object-fit:contain';
          return h('div', { class: 'col center', style: 'gap:0' }, img, h('div', { class: 'small stroke' }, `${ELEMENT_INFO[f.element].icon} Nv ${f.level}`));
        }),
      ),
    ),
    h('div', { class: 'section-title stroke' }, 'TON ÉQUIPE (3 max)'),
    power,
    teamRow,
    h('div', { class: 'small muted' }, 'Astuce : les éléments comptent (FLAME bat NATURE et FROST…). Les créatures ADULT débloquent une 2e compétence, ELITE et TITAN une attaque de zone. Combattre donne de l’XP à ton équipe.'),
    h('div', { class: 'section-title stroke' }, 'TES CRÉATURES'),
    grid,
  );
  return box;
}

/** Animated replay of a deterministic battle. */
function playBattle(app: App, r: BattleResult, items: any[], floor: number, onDone: () => void) {
  const stage = h('div', { class: 'chest-stage', style: '--glow:#b3122f;justify-content:space-around' });
  stage.appendChild(h('div', { class: 'rays' }));
  const hp: Record<string, number> = {};
  const cards: Record<string, HTMLElement> = {};
  const fills: Record<string, HTMLElement> = {};
  const side = (sd: 0 | 1) =>
    h(
      'div',
      { class: 'row center', style: 'z-index:2;gap:18px' },
      r.fighters
        .filter((f) => f.side === sd)
        .map((f) => {
          hp[f.key] = f.maxHp;
          const img = portraits.beast(f.speciesId, f.stage, f.mutation);
          img.style.cssText = `width:110px;height:110px;object-fit:contain;${sd === 1 ? 'transform:scaleX(-1)' : ''}`;
          const fill = h('i', { style: 'width:100%' });
          fills[f.key] = fill;
          const c = h('div', { class: 'col center bfighter', style: 'gap:2px' }, img, h('div', { class: 'small stroke' }, `${ELEMENT_INFO[f.element].icon} ${f.name} · Nv ${f.level}`), h('div', { class: 'bar', style: `width:110px;--b1:${sd === 0 ? '#9df55a' : '#ff7a8a'};--b2:${sd === 0 ? '#37b81c' : '#e0233f'}` }, fill));
          cards[f.key] = c;
          return c;
        }),
    );
  const log = h('div', { class: 'f-title stroke', style: 'z-index:2;font-size:18px;min-height:26px;text-align:center' }, `ÉTAGE ${floor} — COMBAT !`);
  stage.append(side(1), log, side(0), btn('⏩ PASSER', 'white small', () => (i = r.events.length)));
  document.getElementById('ui')!.appendChild(stage);
  const byKey = Object.fromEntries(r.fighters.map((f) => [f.key, f]));
  let i = 0;
  const tick = () => {
    if (i >= r.events.length) return finish();
    const e = r.events[i++];
    const a = byKey[e.actor];
    cards[e.actor]?.classList.remove('bhit', 'bact');
    void cards[e.actor]?.offsetWidth;
    cards[e.actor]?.classList.add('bact');
    e.target.forEach((t, k) => {
      hp[t] = Math.max(0, hp[t] - e.dmg[k]);
      fills[t].style.width = `${(hp[t] / byKey[t].maxHp) * 100}%`;
      cards[t].classList.remove('bhit');
      void cards[t].offsetWidth;
      cards[t].classList.add('bhit');
      if (hp[t] <= 0) cards[t].style.opacity = '0.3';
    });
    log.textContent = `${a.name} → ${e.skill}${e.crit ? ' · CRITIQUE !' : ''}${e.eff > 1 ? ' · SUPER EFFICACE' : e.eff < 1 ? ' · peu efficace' : ''} (${e.dmg.join(' / ')})`;
    audio.sfx(e.target.length > 1 ? 'explode' : e.crit ? 'crit' : 'hit', 1, 0.7);
    if (e.ko.length) audio.sfx('kill');
    setTimeout(tick, 520);
  };
  const finish = () => {
    stage.querySelectorAll('.btn').forEach((x) => x.remove());
    const won = r.winner === 0;
    if (won) {
      audio.sfx('victory');
      haptics.victory();
    } else audio.sfx('defeat');
    log.textContent = '';
    stage.appendChild(h('div', { class: 'res-title stroke-l', style: `z-index:2;color:${won ? '#ffd23a' : '#ff6a7a'}` }, won ? 'VICTOIRE !' : 'DÉFAITE'));
    if (items.length) stage.appendChild(h('div', { style: 'z-index:2' }, rewardItems(items)));
    else if (!won) stage.appendChild(h('div', { class: 'stroke', style: 'z-index:2' }, 'Fais évoluer et nourris tes créatures, ou change d’éléments !'));
    stage.appendChild(h('div', { style: 'z-index:2' }, btn('CONTINUER', 'green big', () => (stage.remove(), onDone()))));
  };
  setTimeout(tick, 700);
}
