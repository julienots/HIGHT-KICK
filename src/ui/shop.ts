import { audio } from '../audio/audio';
import { SKIN_MAP } from '../data/skins';
import type { ChestId } from '../data/economy';
import type { ShopSection } from '../systems/live';
import { fmtDuration, dayIndex, DAY, MIN } from '../core/time';
import type { App, Screen } from './app';
import { btn, confirmModal, h, showRewards, toast } from './dom';
import { screenWithTabs } from './common';
import { portraits } from './portraits';
import { openChestSequence } from './chests';

const TABS: { id: ShopSection; label: string }[] = [
  { id: 'daily', label: '☀️ DAILY' },
  { id: 'featured', label: '⭐ FEATURED' },
  { id: 'skins', label: '🎨 SKINS' },
  { id: 'beasts', label: '🐾 BEASTS' },
  { id: 'chests', label: '🎁 COFFRES' },
  { id: 'bundles', label: '📦 BUNDLES' },
  { id: 'events', label: '🎉 EVENTS' },
];

export function ShopScreen(app: App, params?: { tab?: ShopSection }): Screen {
  let tab: ShopSection = params?.tab ?? 'daily';
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    const offers = app.meta.shop.offers().filter((o) => o.section === tab);
    const body = h('div', { class: 'screen-body' });
    const nextDay = (dayIndex() + 1) * DAY + new Date().getTimezoneOffset() * MIN;
    if (tab === 'daily') body.appendChild(h('div', { class: 'small stroke', style: 'margin-bottom:8px' }, `🔄 Nouvelles offres dans ${fmtDuration(nextDay - Date.now())}`));
    body.appendChild(
      h(
        'div',
        { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr))' },
        offers.length
          ? offers.map((o) => {
              let visual: HTMLElement = h('div', { class: 'si' }, o.icon);
              if (o.previewSkin) {
                const sk = SKIN_MAP[o.previewSkin];
                visual = portraits.jacker(sk.jackerId, sk.id) as any;
              }
              if (o.previewBeast) visual = portraits.beast(o.previewBeast, 2) as any;
              const cur = o.price.currency === 'coins' ? '🪙' : '💎';
              return h(
                'div',
                { class: 'shopitem panel', style: `--panel1:${o.color};--panel2:#2c1d66` },
                o.tag ? h('div', { class: 'tag stroke' }, o.tag) : null,
                visual,
                h('div', { class: 'sn stroke' }, o.name),
                btn(o.free ? 'GRATUIT' : `${cur} ${o.price.amount}`, o.free ? 'green' : o.price.currency === 'gems' ? 'purple' : '', () => {
                  const doBuy = () => {
                    const items = app.meta.shop.buy(o.id);
                    if (!items) return toast(o.price.currency === 'gems' ? 'Pas assez de gemmes' : 'Pas assez de coins', '❌');
                    audio.sfx('buy');
                    // instantly open bought chests for instant gratification
                    const chest = o.rewards.find((r) => r.type === 'chest') as { chestId: ChestId } | undefined;
                    if (chest && o.section === 'chests') {
                      const s = app.meta.state;
                      const i = s.chests.lastIndexOf(chest.chestId);
                      const res = app.meta.rewards.openChest(i);
                      if (res) return openChestSequence(app, chest.chestId, res.items, render);
                    }
                    render();
                  };
                  if (o.free) doBuy();
                  else confirmModal(o.name, `Acheter pour ${o.price.amount} ${cur} ?`, 'ACHETER', doBuy);
                }),
              );
            })
          : [h('div', { class: 'panel', style: 'padding:16px;grid-column:1/-1;text-align:center' }, 'Tout est acheté ! Reviens demain ✨')],
      ),
    );
    body.appendChild(h('div', { class: 'small muted', style: 'margin-top:12px;text-align:center' }, '💎 Les gemmes s’obtiennent en jouant : Pass, quêtes, succès, coffres et route des trophées. Aucun achat réel requis, tout fonctionne hors ligne.'));
    wrap.innerHTML = '';
    wrap.appendChild(screenWithTabs(app, 'BOUTIQUE', TABS, tab, (t) => ((tab = t as ShopSection), render()), body));
  };
  render();
  return { el: wrap, menu3d: false, refresh: render };
}

export { showRewards };
