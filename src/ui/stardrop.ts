import { audio } from '../audio/audio';
import { haptics } from '../audio/haptics';
import { SKIN_MAP } from '../data/skins';
import { DROP_INFO, DROP_RARITIES } from '../systems/renaissance';
import type { App } from './app';
import { btn, h, rewardItems } from './dom';
import { portraits } from './portraits';

/**
 * STAR DROP opening: tap the star, it may upgrade its rarity (RARE → SUPER RARE → EPIC → MYTHIC →
 * LEGENDARY) with escalating colour/sound/haptics, then it bursts and reveals the reward.
 */
export function openStarDrops(app: App, onDone: () => void) {
  const stage = h('div', { class: 'chest-stage stardrop', style: '--glow:#1aa83f' });
  stage.appendChild(h('div', { class: 'rays' }));
  const title = h('div', { class: 'chest-title stroke-l' }, 'COMÈTE');
  const star = h('div', { class: 'sdstar' }, h('div', { class: 'sdcore' }));
  const label = h('div', { class: 'rv-rar stroke', style: 'z-index:2;margin-top:16px;font-family:Lilita One;font-size:22px;padding:4px 16px;border-radius:12px;border:3px solid #1b1035' }, 'RARE');
  const hint = h('div', { class: 'chest-hint stroke' }, 'TOUCHE LA COMÈTE');
  const left = h('div', { class: 'counter-left stroke' });
  stage.append(title, star, label, hint, left);
  document.getElementById('ui')!.appendChild(stage);
  const all: any[] = [];
  let cur: ReturnType<typeof app.meta.starDrops.open> = null;
  let step = 0;
  let phase: 'tap' | 'reveal' | 'done' = 'tap';
  const setRarity = (r: (typeof DROP_RARITIES)[number]) => {
    const info = DROP_INFO[r];
    stage.style.setProperty('--glow', info.glow);
    star.style.setProperty('--sc', info.color);
    label.textContent = info.name;
    label.style.background = info.color;
    label.style.color = r === 'legendary' ? '#1b1035' : '#fff';
  };
  const next = () => {
    stage.querySelectorAll('.reveal').forEach((x) => x.remove());
    cur = app.meta.starDrops.open();
    left.textContent = app.meta.state.starDrops ? `+${app.meta.state.starDrops}` : '';
    if (!cur) {
      phase = 'done';
      star.remove();
      label.remove();
      hint.remove();
      title.textContent = 'RÉCOMPENSES';
      stage.appendChild(h('div', { style: 'z-index:2;max-width:640px' }, rewardItems(all)));
      stage.appendChild(h('div', { style: 'z-index:2;margin-top:16px' }, btn('SUPER !', 'green big', () => (stage.remove(), onDone()))));
      return;
    }
    step = 0;
    phase = 'tap';
    star.style.display = '';
    label.style.display = '';
    star.classList.remove('burst');
    setRarity('rare');
    hint.textContent = 'TOUCHE LA COMÈTE';
    audio.sfx('reveal');
  };
  stage.addEventListener('pointerdown', () => {
    if (phase === 'done' || !cur) return;
    if (phase === 'reveal') return next();
    step++;
    star.classList.remove('bump');
    void star.offsetWidth;
    star.classList.add('bump');
    if (step < cur.steps.length) {
      setRarity(cur.steps[step]);
      audio.sfx(step >= 3 ? 'rare' : 'chestShake', 1 + step * 0.15);
      haptics.impact();
    } else {
      // burst & reveal
      star.classList.add('burst');
      audio.sfx(cur.rarity === 'legendary' || cur.rarity === 'mythic' ? 'rare' : 'chestOpen');
      if (cur.rarity === 'legendary' || cur.rarity === 'mythic') haptics.rare();
      phase = 'reveal';
      setTimeout(() => {
        if (!cur) return;
        star.style.display = 'none';
        const it = cur.items[0];
        all.push(...cur.items);
        let visual: HTMLElement = h('div', { class: 'big' }, it?.icon ?? '🎁');
        if (it?.reward.type === 'skin') {
          const sk = SKIN_MAP[it.reward.skinId];
          if (sk) visual = portraits.jacker(sk.jackerId, sk.id, 'victory') as any;
        } else if (it?.reward.type === 'jacker') visual = portraits.jacker(it.reward.jackerId, undefined, 'victory') as any;
        stage.insertBefore(h('div', { class: 'reveal' }, visual, h('div', { class: 'rv-name stroke-l' }, it?.label ?? '')), label);
        hint.textContent = app.meta.state.starDrops ? 'TOUCHE POUR LA SUIVANTE' : 'TOUCHE POUR CONTINUER';
      }, 380);
    }
  });
  next();
}
