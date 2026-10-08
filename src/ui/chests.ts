import { audio } from '../audio/audio';
import { haptics } from '../audio/haptics';
import { CHEST_ORDER, CHESTS, type ChestId } from '../data/economy';
import { RARITY_INFO, rarityIndex, type Rarity } from '../data/rarities';
import { SKIN_MAP } from '../data/skins';
import type { GrantedItem } from '../systems/ctx';
import type { App, Screen } from './app';
import { btn, h, rewardItems, toast } from './dom';
import { topBarMini } from './common';
import { portraits } from './portraits';

function chestEl(id: ChestId) {
  const c = CHESTS[id];
  return h(
    'div',
    { class: 'chest', style: `--cc1:${c.color};--cc2:${shadeHex(c.color)};--trim:${c.trim}` },
    h('div', { class: 'cbody' }, h('div', { class: 'band', style: 'left:24px' }), h('div', { class: 'band', style: 'right:24px' })),
    h('div', { class: 'clid' }, h('div', { class: 'band', style: 'left:30px' }), h('div', { class: 'band', style: 'right:30px' })),
    h('div', { class: 'lock' }),
  );
}
function shadeHex(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.62));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/**
 * Chest opening sequence: shake → burst open → items revealed one by one (rarity colours, sound
 * crescendo, haptics for rare drops) → summary.
 */
export function openChestSequence(app: App, id: ChestId, items: GrantedItem[], onDone: () => void) {
  const c = CHESTS[id];
  const best = items.reduce((m, it) => Math.max(m, it.rarity && (RARITY_INFO as any)[it.rarity] ? rarityIndex(it.rarity as Rarity) : 0), 0);
  const stage = h('div', { class: 'chest-stage', style: `--glow:${c.color}` });
  const rays = h('div', { class: 'rays' });
  stage.appendChild(rays);
  const title = h('div', { class: 'chest-title stroke-l' }, c.name);
  const ch = chestEl(id);
  const hint = h('div', { class: 'chest-hint stroke' }, 'TOUCHE POUR OUVRIR');
  const counter = h('div', { class: 'counter-left stroke' }, '');
  stage.append(title, ch, hint, counter);
  document.getElementById('ui')!.appendChild(stage);
  audio.sfx('chestRise');
  let phase = 0;
  let idx = 0;
  let taps = 0;
  const showItem = () => {
    stage.querySelectorAll('.reveal').forEach((r) => r.remove());
    if (idx >= items.length) {
      // summary
      ch.remove();
      hint.remove();
      counter.textContent = '';
      title.textContent = 'RÉCOMPENSES';
      stage.appendChild(h('div', { style: 'z-index:2;max-width:640px' }, rewardItems(items)));
      stage.appendChild(h('div', { style: 'z-index:2;margin-top:16px' }, btn('SUPER !', 'green big', () => (stage.remove(), onDone()))));
      phase = 3;
      return;
    }
    const it = items[idx++];
    counter.textContent = `${items.length - idx}`;
    const rar = it.rarity && (RARITY_INFO as any)[it.rarity] ? RARITY_INFO[it.rarity as Rarity] : null;
    let visual: HTMLElement = h('div', { class: 'big' }, it.icon);
    if (it.reward.type === 'beast' && it.reward.beastId) visual = portraits.beast(it.reward.beastId, 2) as any;
    if (it.reward.type === 'skin') {
      const sk = SKIN_MAP[it.reward.skinId];
      if (sk) visual = portraits.jacker(sk.jackerId, sk.id, 'victory') as any;
    }
    if (it.reward.type === 'jacker') visual = portraits.jacker(it.reward.jackerId, undefined, 'victory') as any;
    const rv = h(
      'div',
      { class: 'reveal' },
      visual,
      h('div', { class: 'rv-name stroke-l' }, it.label),
      rar ? h('div', { class: 'rv-rar stroke', style: `background:${rar.color}` }, rar.name) : it.isNew ? h('div', { class: 'rv-rar stroke', style: 'background:#ff4d6d' }, 'NOUVEAU !') : null,
    );
    stage.insertBefore(rv, hint);
    stage.style.setProperty('--glow', rar ? rar.glow : it.color);
    const ri = rar ? rarityIndex(it.rarity as Rarity) : 0;
    if (ri >= 3 || it.reward.type === 'jacker' || it.reward.type === 'skin') {
      audio.sfx('rare');
      haptics.rare();
    } else audio.sfx('reveal', 1 + ri * 0.1);
  };
  stage.addEventListener('pointerdown', () => {
    if (phase === 0) {
      taps++;
      ch.classList.add('shake');
      audio.sfx('chestShake');
      haptics.impact();
      if (taps >= (best >= 3 ? 3 : 2)) {
        phase = 1;
        setTimeout(() => {
          ch.classList.remove('shake');
          ch.classList.add('open');
          audio.sfx('chestOpen');
          haptics.super();
          hint.textContent = 'TOUCHE POUR CONTINUER';
          title.textContent = best >= 3 ? '✨ RARE ! ✨' : c.name;
          setTimeout(() => {
            phase = 2;
            ch.style.transform = 'scale(0.6) translateY(140px)';
            ch.style.transition = 'transform 0.3s';
            showItem();
          }, 450);
        }, 250);
      } else setTimeout(() => ch.classList.remove('shake'), 350);
    } else if (phase === 2) showItem();
  });
}

export function ChestsScreen(app: App): Screen {
  const el = h('div', { class: 'screen bg' });
  const render = () => {
    el.innerHTML = '';
    const s = app.meta.state;
    el.appendChild(h('div', { class: 'screen-head' }, btn('⬅', 'white iconbtn back', () => app.back()), h('h1', { class: 'stroke-l' }, 'COFFRES'), topBarMini(app)));
    const counts: Partial<Record<ChestId, number>> = {};
    for (const c of s.chests) counts[c] = (counts[c] ?? 0) + 1;
    const body = h('div', { class: 'screen-body' });
    if (!s.chests.length) body.appendChild(h('div', { class: 'panel', style: 'padding:20px;text-align:center' }, h('div', { style: 'font-size:60px' }, '📦'), h('div', { class: 'f-title stroke', style: 'font-size:22px' }, 'Aucun coffre'), h('p', { class: 'muted' }, 'Gagne des matchs, monte de niveau, termine des quêtes et progresse dans le SUPER PASS pour en obtenir. Tu peux aussi en acheter dans la boutique.'), btn('🛒 BOUTIQUE', 'blue', () => app.go('shop', { tab: 'chests' }))));
    body.appendChild(
      h(
        'div',
        { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(210px,1fr))' },
        CHEST_ORDER.filter((id) => counts[id]).map((id) => {
          const c = CHESTS[id];
          const mini = chestEl(id);
          mini.style.transform = 'scale(0.55)';
          mini.style.margin = '-30px auto -20px';
          return h(
            'div',
            { class: 'panel', style: `padding:10px;text-align:center;--panel1:${c.color};--panel2:#2c1d66` },
            h('div', { class: 'f-title stroke', style: 'font-size:20px' }, `${c.name} ×${counts[id]}`),
            mini,
            h('div', { class: 'small muted' }, `${c.rolls} récompenses · créatures ${Math.round(c.beastChance * 100)}%`),
            btn('OUVRIR', 'green', () => {
              const i = s.chests.indexOf(id);
              const res = app.meta.rewards.openChest(i);
              if (!res) return;
              openChestSequence(app, id, res.items, () => render());
            }),
          );
        }),
      ),
    );
    if (s.chests.length > 1)
      body.appendChild(
        h(
          'div',
          { class: 'row center', style: 'margin-top:14px' },
          btn('TOUT OUVRIR', 'purple', () => {
            const all: GrantedItem[] = [];
            while (s.chests.length) {
              const r = app.meta.rewards.openChest(0);
              if (r) all.push(...r.items);
            }
            openChestSequence(app, 'gold', all, () => render());
            toast('Tous les coffres sont ouverts', '🎁');
          }),
        ),
      );
    el.appendChild(body);
  };
  render();
  return { el, menu3d: false, refresh: render };
}
