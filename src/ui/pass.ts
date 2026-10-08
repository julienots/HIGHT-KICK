import { audio } from '../audio/audio';
import { CHESTS, type Reward } from '../data/economy';
import { getBeast } from '../data/beasts';
import { PASS_PREMIUM_PRICE, PASS_TIERS, PASS_XP_PER_TIER, seasonInfo } from '../data/seasons';
import { SKIN_MAP } from '../data/skins';
import { fmtDuration } from '../core/time';
import type { App, Screen } from './app';
import { bar, btn, confirmModal, h, toast } from './dom';
import { screenWithTabs } from './common';
import { portraits } from './portraits';

export function rewardVisual(r: Reward): { icon: HTMLElement | string; label: string } {
  switch (r.type) {
    case 'coins':
      return { icon: '🪙', label: `${r.amount}` };
    case 'gems':
      return { icon: '💎', label: `${r.amount}` };
    case 'energy':
      return { icon: '⭐', label: `${r.amount}` };
    case 'shards':
      return { icon: '🧬', label: `${r.amount}` };
    case 'chest':
      return { icon: '🎁', label: CHESTS[r.chestId].name.replace(' CHEST', '') };
    case 'egg':
      return { icon: '🥚', label: r.rarity.toUpperCase() };
    case 'skin': {
      const sk = SKIN_MAP[r.skinId];
      const img = portraits.jacker(sk.jackerId, sk.id);
      img.style.cssText = 'width:54px;height:54px;object-fit:contain';
      return { icon: img, label: sk.name };
    }
    case 'beast': {
      if (!r.beastId) return { icon: '🐾', label: 'Créature' };
      const img = portraits.beast(r.beastId, 2);
      img.style.cssText = 'width:54px;height:54px;object-fit:contain';
      return { icon: img, label: getBeast(r.beastId).name };
    }
    case 'emote':
      return { icon: r.emote, label: 'Emote' };
    case 'title':
      return { icon: '🏷️', label: r.title };
    case 'jacker':
      return { icon: '🧑‍🚀', label: r.jackerId.toUpperCase() };
    default:
      return { icon: '🎁', label: '' };
  }
}

export function PassScreen(app: App): Screen {
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    const s = app.meta.state;
    const ps = app.meta.pass;
    const season = seasonInfo();
    const tier = ps.tier();
    const tiers = ps.tiers();
    const body = h('div', { class: 'screen-body' });
    body.appendChild(
      h(
        'div',
        { class: 'panel', style: `padding:12px;margin-bottom:10px;--panel1:${season.theme.color};--panel2:${season.theme.color2}` },
        h('div', { class: 'row wrap' }, h('div', { class: 'col', style: 'flex:1;min-width:200px;gap:2px' }, h('div', { class: 'f-title stroke-l', style: 'font-size:24px' }, `SUPER PASS · SAISON ${season.number}`), h('div', { class: 'stroke' }, season.theme.name + ' — ' + season.theme.subtitle), h('div', { class: 'small stroke' }, `⏳ Fin dans ${fmtDuration(season.remaining)}`)), s.pass.premium ? h('div', { class: 'chip', style: 'background:#ffb300;font-size:16px' }, '👑 PREMIUM ACTIF') : btn(`👑 PREMIUM ${PASS_PREMIUM_PRICE}💎`, 'purple big', () => confirmModal('SUPER PASS PREMIUM', `Débloquer le chemin premium (skins exclusifs, créatures, emotes, titres) pour ${PASS_PREMIUM_PRICE} gemmes ?`, 'DÉBLOQUER', () => (ps.buyPremium() ? (audio.sfx('rare'), render()) : toast('Pas assez de gemmes', '💎')), 'purple'))),
        h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'f-title stroke', style: 'font-size:22px' }, `PALIER ${tier}`), h('div', { style: 'flex:1' }, bar(s.pass.xp % PASS_XP_PER_TIER, PASS_XP_PER_TIER, tier >= PASS_TIERS ? 'MAX' : `${s.pass.xp % PASS_XP_PER_TIER} / ${PASS_XP_PER_TIER} XP`, '#fff27a', '#ffb300'))),
      ),
    );
    body.appendChild(h('div', { class: 'passrow', style: 'margin-bottom:6px' }, h('div'), h('div', { class: 'f-title stroke', style: 'text-align:center' }, 'GRATUIT'), h('div', { class: 'f-title stroke', style: 'text-align:center;color:#ffd23a' }, '👑 PREMIUM')));
    const cell = (r: Reward | null, t: number, track: 'free' | 'prem') => {
      if (!r) return h('div', { class: 'passcell', style: 'opacity:.3' }, '—');
      const claimed = track === 'free' ? s.pass.free.includes(t) : s.pass.prem.includes(t);
      const reached = t <= tier;
      const can = reached && !claimed && (track === 'free' || s.pass.premium);
      const v = rewardVisual(r);
      return h(
        'div',
        {
          class: 'passcell' + (can ? ' claim' : '') + (claimed ? ' done' : '') + (track === 'prem' && !s.pass.premium ? ' lock' : ''),
          onclick: () => {
            if (!can) return;
            const items = ps.claim(t, track);
            if (items) render();
          },
        },
        h('div', { class: 'pi' }, v.icon),
        h('div', { class: 'stroke' }, v.label),
        claimed ? h('div', null, '✔') : null,
      );
    };
    const list = h('div', { class: 'col', style: 'gap:6px' });
    for (const t of tiers) list.appendChild(h('div', { class: 'passrow' }, h('div', { class: 'passtier' + (t.tier <= tier ? ' reached' : '') }, String(t.tier)), cell(t.free, t.tier, 'free'), cell(t.premium, t.tier, 'prem')));
    body.appendChild(list);
    wrap.innerHTML = '';
    wrap.appendChild(screenWithTabs(app, 'SUPER PASS', [], '', () => {}, body));
    // scroll to current tier
    requestAnimationFrame(() => {
      const row = list.children[Math.max(0, tier - 2)] as HTMLElement | undefined;
      if (row) body.scrollTop = row.offsetTop - 100;
    });
  };
  render();
  return { el: wrap, menu3d: false, refresh: render };
}
