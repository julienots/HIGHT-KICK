import { audio } from '../audio/audio';
import { ELEMENT_INFO } from '../data/elements';
import { GADGET_LEVEL, levelStatMult, MAX_JACKER_LEVEL, rankFor, SPECIAL_LEVEL, STARPOWER_LEVEL } from '../data/economy';
import { getJacker, JACKERS, ROLE_INFO, type AbilityDef } from '../data/jackers';
import { SKIN_RARITY_INFO, skinsFor } from '../data/skins';
import { HP_SCALE } from '../sim/entities';
import type { App, Screen } from './app';
import { bar, btn, chip, confirmModal, h, toast } from './dom';
import { topBarMini } from './common';
import { portraits } from './portraits';

export function JackersScreen(app: App): Screen {
  const el = h('div', { class: 'screen bg' });
  const render = () => {
    el.innerHTML = '';
    const s = app.meta.state;
    el.appendChild(h('div', { class: 'screen-head' }, btn('⬅', 'white iconbtn back', () => app.back()), h('h1', { class: 'stroke-l' }, 'JACKERS'), h('div', { class: 'chip', style: 'background:#3a2d7a' }, `${JACKERS.filter((j) => s.jackers[j.id].unlocked).length}/${JACKERS.length}`), topBarMini(app)));
    const sorted = JACKERS.slice().sort((a, b) => Number(s.jackers[b.id].unlocked) - Number(s.jackers[a.id].unlocked) || a.unlockTrophies - b.unlockTrophies);
    el.appendChild(
      h(
        'div',
        { class: 'screen-body' },
        h(
          'div',
          { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(118px,1fr))' },
          sorted.map((j) => {
            const jp = s.jackers[j.id];
            const role = ROLE_INFO[j.role];
            const info = app.meta.progression.upgradeInfo(j.id);
            const sel = s.profile.selectedJacker === j.id;
            return h(
              'div',
              { class: 'card' + (jp.unlocked ? '' : ' locked'), style: `--cc1:${role.color};--cc2:#2c1d66;${sel ? 'outline:4px solid #ffe760' : ''}`, onclick: () => (audio.sfx('click'), app.push('jacker', { id: j.id })) },
              h('div', { class: 'portrait' }, portraits.jacker(j.id, jp.skin)),
              jp.unlocked ? h('div', { class: 'clvl' }, chip(`Nv ${jp.level}`, '#3a2d7a')) : null,
              jp.unlocked ? h('div', { class: 'ctr' }, chip(`🏆${jp.trophies}`, rankFor(jp.trophies).color, '#1b1035')) : null,
              jp.unlocked && !info.maxed ? h('div', { class: 'shardbar' + (info.canAfford ? ' ready' : '') }, h('i', { style: `width:${Math.min(100, ((jp.shards + s.currencies.shards) / info.cost.shards) * 100)}%` })) : null,
              !jp.unlocked ? h('div', { class: 'lockicon' }, '🔒') : null,
              h('div', { class: 'cname' }, `${role.icon} ${j.name}`),
            );
          }),
        ),
      ),
    );
  };
  render();
  return { el, menu3d: false, refresh: render };
}

function abilityText(def: AbilityDef) {
  const d: any = def;
  const parts: string[] = [];
  if (d.dmg) parts.push(`💥 ${d.dmg}`);
  if (d.amount) parts.push(`${def.kind === 'heal' ? '💚' : '🛡️'} ${d.amount}`);
  if (d.radius) parts.push(`◎ ${d.radius}m`);
  if (d.range) parts.push(`➶ ${d.range}m`);
  if (d.duration) parts.push(`⏱ ${d.duration}s`);
  if (d.count && d.count > 1) parts.push(`×${d.count}`);
  return parts.join(' · ');
}

export function JackerDetail(app: App, params: { id: string }): Screen {
  const el = h('div', { class: 'screen' });
  const render = () => {
    el.innerHTML = '';
    const s = app.meta.state;
    const j = getJacker(params.id);
    const jp = s.jackers[j.id];
    app.menu.setHero(j.id, jp.skin);
    const role = ROLE_INFO[j.role];
    const el2 = ELEMENT_INFO[j.element];
    const info = app.meta.progression.upgradeInfo(j.id);
    const m = levelStatMult(jp.level),
      mn = levelStatMult(Math.min(MAX_JACKER_LEVEL, jp.level + 1));
    const statRow = (icon: string, name: string, v: number, vn: number) =>
      h('div', { class: 'statrow' }, h('div', { class: 'si' }, icon), h('div', null, name), h('div', { class: 'sv stroke' }, String(Math.round(v)), jp.unlocked && !info.maxed && vn > v ? h('span', { class: 'up' }, `+${Math.round(vn - v)}`) : null));
    const ab = (icon: string, color: string, name: string, desc: string, extra = '') =>
      h('div', { class: 'ability' }, h('div', { class: 'ai', style: `background:${color}` }, icon), h('div', null, h('div', { class: 'an stroke' }, name), h('div', { class: 'ad' }, desc), extra ? h('div', { class: 'ad', style: 'opacity:0.8' }, extra) : null));
    const choice = (title: string, unlockLv: number, opts: { name: string; desc: string; icon?: string }[], cur: 0 | 1, slot: 'gadget' | 'starPower' | 'special') =>
      h(
        'div',
        null,
        h('div', { class: 'section-title stroke' }, `${title} ${jp.level < unlockLv ? `🔒 Nv ${unlockLv}` : ''}`),
        h(
          'div',
          { class: 'choice' },
          opts.map((o, i) =>
            h(
              'div',
              { class: 'opt' + (cur === i && jp.level >= unlockLv ? ' on' : '') + (jp.level < unlockLv || !jp.unlocked ? ' lockd' : ''), onclick: () => (audio.sfx('click'), app.meta.progression.setLoadout(j.id, slot, i as 0 | 1)) },
              h('b', null, `${o.icon ?? ''} ${o.name}`),
              h('span', null, o.desc),
            ),
          ),
        ),
      );
    const skins = skinsFor(j.id);
    const right = h(
      'div',
      { class: 'detail-info panel dark', style: 'padding:12px;overflow-y:auto;touch-action:pan-y' },
      h('div', { class: 'row wrap' }, h('div', { class: 'f-title stroke-l', style: 'font-size:34px' }, j.name), chip(`${role.icon} ${role.name}`, role.color), chip(`${el2.icon} ${el2.name}`, el2.dark), jp.unlocked ? chip(`🏆 ${jp.trophies} (max ${jp.highest})`, '#3a2d7a') : null),
      h('div', { class: 'muted' }, `« ${j.title} » — ${j.lore}`),
      jp.unlocked
        ? h(
            'div',
            { class: 'row wrap' },
            h('div', { style: 'flex:1;min-width:180px' }, h('div', { class: 'small stroke' }, `NIVEAU ${jp.level}/${MAX_JACKER_LEVEL}`), bar(jp.shards + s.currencies.shards, info.cost.shards, info.maxed ? 'MAX' : `🧬 ${jp.shards} (+${s.currencies.shards}) / ${info.cost.shards}`, '#e8a8ff', '#a24df0')),
            info.maxed
              ? chip('NIVEAU MAX ⭐', '#ffb300')
              : btn(`⬆ AMÉLIORER 🪙${info.cost.coins}`, info.canAfford ? 'green' : 'gray', () => {
                  if (!info.canAfford) return toast('Pas assez de coins ou de shards', '❌');
                  if (app.meta.progression.upgrade(j.id)) {
                    audio.sfx('levelUp');
                    app.menu.poke();
                    toast(`${j.name} niveau ${jp.level} !`, '⬆️', '#37b81c');
                  }
                }),
          )
        : h(
            'div',
            { class: 'row wrap' },
            chip(`🔒 Débloqué à ${j.unlockTrophies} 🏆 (route des trophées)`, '#3a2d7a'),
            btn(`DÉBLOQUER 💎${app.meta.progression.jackerPrice(j.id)}`, 'purple', () =>
              confirmModal('Débloquer ' + j.name, `Utiliser ${app.meta.progression.jackerPrice(j.id)} gemmes ?`, 'DÉBLOQUER', () => {
                if (!app.meta.progression.buyJacker(j.id)) toast('Pas assez de gemmes', '💎');
              }),
            ),
          ),
      h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px' }, statRow('❤️', 'PV', j.hp * HP_SCALE * m, j.hp * HP_SCALE * mn), statRow('💥', 'Dégâts', j.attack.dmg * m, j.attack.dmg * mn), statRow('💨', 'Vitesse', j.speed * 10, j.speed * 10), statRow('🎯', 'Portée', j.attack.range, j.attack.range)),
      ab('⚔️', '#ff4d6d', `ATTAQUE · ${j.attack.name}`, `${j.attack.kind.toUpperCase()} · ${j.attack.ammo} munitions`, `💥 ${Math.round(j.attack.dmg * m)} · ➶ ${j.attack.range}m`),
      ab(j.skill.icon, '#1f7cf2', `COMPÉTENCE · ${j.skill.name}`, j.skill.desc, `${abilityText(j.skill.def)} · ⏳ ${j.skill.cd}s`),
      ab(j.super.icon, '#ffb300', `SUPER · ${j.super.name}`, j.super.desc, abilityText(j.super.def)),
      ab('✨', '#8a35e0', `PASSIF · ${j.passive.name}`, j.passive.desc),
      choice('GADGET', GADGET_LEVEL, j.gadgets, jp.gadget, 'gadget'),
      choice('STAR POWER', STARPOWER_LEVEL, j.starPowers, jp.starPower, 'starPower'),
      choice('POUVOIR SPÉCIAL', SPECIAL_LEVEL, j.specials, jp.special, 'special'),
      h('div', { class: 'section-title stroke' }, 'SKINS'),
      h(
        'div',
        { class: 'skinrow' },
        skins.map((sk) => {
          const owned = jp.skins.includes(sk.id);
          const r = SKIN_RARITY_INFO[sk.rarity];
          return h(
            'div',
            {
              class: 'card skin' + (jp.skin === sk.id ? ' on' : '') + (owned ? '' : ' locked'),
              style: `--cc1:${r.color};--cc2:#2c1d66`,
              onclick: () => {
                audio.sfx('click');
                if (owned) {
                  jp.skin = sk.id;
                  app.meta.dirty();
                  render();
                } else if (sk.exclusive) toast('Skin exclusif du SUPER PASS', '🎟️');
                else if (!jp.unlocked) toast('Débloque d’abord ce Jacker', '🔒');
                else
                  confirmModal(sk.name, `${r.name} · ${r.gems} 💎`, 'ACHETER', () => {
                    if (s.currencies.gems < r.gems) return toast('Pas assez de gemmes', '💎');
                    s.currencies.gems -= r.gems;
                    app.meta.rewards.grant([{ type: 'skin', skinId: sk.id }], 'shop');
                    jp.skin = sk.id;
                    audio.sfx('buy');
                    render();
                  });
              },
            },
            h('div', { class: 'portrait' }, portraits.jacker(j.id, sk.id)),
            h('div', { class: 'cname', style: 'font-size:11px' }, owned ? sk.name : sk.exclusive ? '🎟️ PASS' : `💎 ${r.gems}`),
          );
        }),
      ),
    );
    const sel = s.profile.selectedJacker === j.id;
    el.appendChild(
      h(
        'div',
        { class: 'screen-head' },
        btn('⬅', 'white iconbtn back', () => app.back()),
        h('div', { class: 'spacer' }),
        topBarMini(app),
      ),
    );
    el.appendChild(
      h(
        'div',
        { class: 'screen-body' },
        h(
          'div',
          { class: 'detail' },
          h(
            'div',
            { class: 'detail-stage', onclick: () => (app.menu.poke(), audio.sfx('voice', j.voice)) },
            h(
              'div',
              { style: 'position:absolute;bottom:6px;left:0;right:0;display:flex;justify-content:center' },
              jp.unlocked ? btn(sel ? '✔ SÉLECTIONNÉ' : 'CHOISIR', sel ? 'gray' : 'green big', () => {
                s.profile.selectedJacker = j.id;
                app.meta.dirty();
                audio.sfx('voice', j.voice);
                app.menu.poke();
                render();
              }) : null,
            ),
          ),
          right,
        ),
      ),
    );
  };
  render();
  return { el, menu3d: 1, refresh: render };
}
