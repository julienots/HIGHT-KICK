import { audio } from '../audio/audio';
import { haptics } from '../audio/haptics';
import { BEASTS, getBeast, STAGE_INFO, STAGES, compatible } from '../data/beasts';
import { ELEMENT_INFO } from '../data/elements';
import { FOOD_MAP, FOODS } from '../data/economy';
import { RARITY_INFO } from '../data/rarities';
import { fmtDuration } from '../core/time';
import { beastStats, beastXpForLevel, MAX_INCUBATORS, stageCap } from '../systems/beasts';
import type { BeastInstance } from '../systems/state';
import type { App, Screen } from './app';
import { bar, btn, chip, h, modal, showRewards, toast } from './dom';
import { screenWithTabs } from './common';
import { portraits } from './portraits';

const MUT_ICON: Record<string, string> = { none: '', shiny: '✨', giant: '🗻', shadow: '🌑', prism: '🌈' };

function beastCard(b: BeastInstance, onClick: () => void, extra?: HTMLElement | null) {
  const sp = getBeast(b.speciesId);
  const r = RARITY_INFO[sp.rarity];
  return h(
    'div',
    { class: 'card beastcard', style: `--cc1:${r.color};--cc2:#2c1d66`, onclick: () => (audio.sfx('click'), onClick()) },
    h('div', { class: 'portrait' }, portraits.beast(sp.id, b.stage, b.mutation)),
    h('div', { class: 'elem' }, ELEMENT_INFO[sp.element].icon),
    h('div', { class: 'stage' }, chip(`${STAGE_INFO[STAGES[b.stage]].name} ${b.level}`, '#3a2d7a')),
    b.mutation !== 'none' ? h('div', { class: 'mut' }, chip(MUT_ICON[b.mutation], '#ff5ad6')) : null,
    h('div', { class: 'cname' }, (b.favorite ? '❤️ ' : '') + (b.stage >= 3 ? sp.forms[b.stage] : sp.name)),
    extra ?? null,
  );
}

export function openBeastDetail(app: App, uid: string, onChange: () => void) {
  const body = h('div', { class: 'col' });
  const render = () => {
    const b = app.meta.beasts.get(uid);
    if (!b) return m.close();
    body.innerHTML = '';
    const s = app.meta.state;
    const sp = getBeast(b.speciesId);
    const r = RARITY_INFO[sp.rarity];
    const el = ELEMENT_INFO[sp.element];
    const st = beastStats(b);
    const cap = stageCap(b.stage);
    const ev = app.meta.beasts.canEvolve(b);
    const img = portraits.beast(sp.id, b.stage, b.mutation);
    img.style.cssText = 'width:150px;height:150px;object-fit:contain;filter:drop-shadow(0 6px 0 rgba(0,0,0,.35))';
    body.append(
      h('div', { class: 'row center wrap' }, img, h('div', { class: 'col', style: 'min-width:200px;flex:1' }, h('div', { class: 'f-title stroke-l', style: 'font-size:28px' }, `#${sp.num} ${b.stage >= 3 ? sp.forms[b.stage] : sp.name}`), h('div', { class: 'row wrap' }, chip(r.name, r.color, '#1b1035'), chip(`${el.icon} ${el.name}`, el.dark), chip(STAGE_INFO[STAGES[b.stage]].name, '#3a2d7a'), b.mutation !== 'none' ? chip(`${MUT_ICON[b.mutation]} ${b.mutation.toUpperCase()}`, '#ff5ad6') : null), h('div', { class: 'small muted' }, sp.lore), h('div', { class: 'small' }, `🏠 ${sp.habitat} · ❤️ Préfère : ${FOOD_MAP[sp.favFood].icon} ${FOOD_MAP[sp.favFood].name}`))),
      h('div', { class: 'small stroke' }, `NIVEAU ${b.level} / ${cap}`),
      bar(b.xp, beastXpForLevel(b.level), b.level >= cap ? 'PRÊT À ÉVOLUER' : `${b.xp} / ${beastXpForLevel(b.level)} XP`, '#8ce0ff', '#1f7cf2'),
      h('div', { class: 'grid', style: 'grid-template-columns:repeat(4,1fr);gap:6px' }, ...[['❤️', 'PV', st.hp], ['💥', 'ATK', st.atk], ['🛡️', 'DEF', st.def], ['💨', 'VIT', st.spd]].map(([i, n, v]) => h('div', { class: 'pstat' }, `${i} ${n}`, h('b', null, String(v))))),
      h('div', { class: 'small' }, '⚔️ Compétences : ' + sp.skills.map((k, i) => (b.stage >= [0, 2, 3][i] ? `${k.name}` : `🔒 ${k.name}`)).join(' · ')),
      h('div', { class: 'section-title stroke' }, '🍖 NOURRIR'),
      h(
        'div',
        { class: 'row wrap' },
        FOODS.filter((f) => (s.food[f.id] ?? 0) > 0).length
          ? FOODS.filter((f) => (s.food[f.id] ?? 0) > 0).map((f) =>
              btn(`${f.icon} ×${s.food[f.id]}${f.id === sp.favFood ? ' ❤️' : ''}`, f.id === sp.favFood ? 'small' : 'white small', () => {
                const res = app.meta.beasts.feed(uid, f.id);
                toast(res.msg, res.ok ? f.icon : '⚠️');
                if (res.ok) audio.sfx('heal');
                render();
              }),
            )
          : h('div', { class: 'small muted' }, 'Pas de nourriture : cultive-en à la FERME !'),
      ),
      h(
        'div',
        { class: 'row wrap center', style: 'margin-top:8px' },
        b.stage < 4
          ? btn(`🧬 ÉVOLUER (${ev.cost}⭐)`, ev.ok ? 'purple' : 'gray', () => {
              if (!ev.ok) return toast(ev.reason, '🔒');
              if (app.meta.beasts.evolve(uid)) {
                audio.sfx('rare');
                haptics.rare();
                toast(`${sp.name} évolue en ${STAGE_INFO[STAGES[b.stage]].name} !`, '🧬', '#8a35e0');
                render();
              }
            })
          : chip('👑 FORME TITAN', '#ffb300'),
        btn(s.profile.companion === uid ? '✔ COMPAGNON' : '🐾 COMPAGNON', s.profile.companion === uid ? 'gray' : 'blue', () => {
          s.profile.companion = s.profile.companion === uid ? null : uid;
          app.meta.dirty();
          toast(s.profile.companion ? `${sp.name} t’accompagne en match (bonus PV/dégâts)` : 'Compagnon retiré', '🐾');
          render();
        }),
        btn(b.favorite ? '💔' : '❤️', 'white iconbtn', () => {
          b.favorite = !b.favorite;
          app.meta.dirty();
          render();
        }),
      ),
    );
  };
  const m = modal(body, { onClose: onChange });
  render();
}

export function BeastsScreen(app: App, params?: { tab?: string }): Screen {
  let tab = params?.tab ?? 'collection';
  let el = h('div');
  let timer: any;
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    const s = app.meta.state;
    const n = app.meta.notifications();
    const body = h('div', { class: 'screen-body' });
    switch (tab) {
      case 'collection':
        body.appendChild(collection(app, render));
        break;
      case 'bestiary':
        body.appendChild(bestiary(app));
        break;
      case 'eggs':
        body.appendChild(eggs(app, render));
        break;
      case 'breeding':
        body.appendChild(breeding(app, render));
        break;
      case 'farm':
        body.appendChild(farm(app, render));
        break;
    }
    const nEggs = s.eggs.filter((e) => e.incubating && e.hatchAt <= app.meta.now()).length;
    el = screenWithTabs(
      app,
      'BEASTS',
      [
        { id: 'collection', label: `🐾 COLLECTION (${s.beasts.length})` },
        { id: 'bestiary', label: '📖 BESTIAIRE' },
        { id: 'eggs', label: `🥚 ŒUFS (${s.eggs.length})`, badge: nEggs },
        { id: 'breeding', label: '💞 ÉLEVAGE', badge: s.breeding && s.breeding.end <= app.meta.now() ? 1 : 0 },
        { id: 'farm', label: '🌱 FERME', badge: n.farm },
      ],
      tab,
      (t) => ((tab = t), render()),
      body,
    );
    wrap.innerHTML = '';
    wrap.appendChild(el);
  };
  render();
  return {
    el: wrap,
    menu3d: false,
    refresh: render,
    mount() {
      // live timers (eggs, breeding, farm)
      timer = setInterval(() => wrap.querySelectorAll('[data-until]').forEach((x) => (x.textContent = fmtDuration(+(x as HTMLElement).dataset.until! - Date.now()))), 1000);
    },
    unmount() {
      clearInterval(timer);
    },
  };
}

function collection(app: App, rerender: () => void) {
  const s = app.meta.state;
  const sorted = s.beasts.slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.stage - a.stage || b.level - a.level);
  return h(
    'div',
    null,
    h('div', { class: 'small muted', style: 'margin-bottom:8px' }, `Nourris tes créatures pour les faire monter de niveau, puis fais-les évoluer avec de la BEAST ENERGY ⭐ (${s.currencies.energy}). Choisis un compagnon pour un bonus en match.`),
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(112px,1fr))' }, sorted.map((b) => beastCard(b, () => openBeastDetail(app, b.uid, rerender), s.profile.companion === b.uid ? h('div', { style: 'position:absolute;bottom:26px;right:4px' }, chip('🐾', '#1f7cf2')) : null))),
  );
}

function bestiary(app: App) {
  const s = app.meta.state;
  const owned = new Set(s.beasts.map((b) => b.speciesId));
  return h(
    'div',
    null,
    h('div', { class: 'f-title stroke', style: 'font-size:18px;margin-bottom:8px' }, `${owned.size} / ${BEASTS.length} espèces découvertes`),
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(100px,1fr))' },
      BEASTS.map((sp) => {
        const has = owned.has(sp.id);
        const r = RARITY_INFO[sp.rarity];
        const img = portraits.beast(sp.id, 2);
        if (!has) img.style.filter = 'brightness(0) opacity(0.55)';
        return h(
          'div',
          { class: 'card', style: `--cc1:${has ? r.color : '#5a5a7a'};--cc2:#2c1d66`, onclick: () => toast(has ? `${sp.name} · ${r.name} · ${sp.habitat}` : `??? · ${r.name} · ${sp.habitat}`, ELEMENT_INFO[sp.element].icon) },
          h('div', { class: 'portrait' }, img),
          h('div', { class: 'clvl' }, chip(`#${sp.num}`, '#3a2d7a')),
          h('div', { class: 'cname', style: 'font-size:12px' }, has ? sp.name : '???'),
        );
      }),
    ),
  );
}

function eggs(app: App, rerender: () => void) {
  const s = app.meta.state;
  const now = app.meta.now();
  const inc = s.eggs.filter((e) => e.incubating);
  const waiting = s.eggs.filter((e) => !e.incubating);
  const eggIcon = (r: string) => h('div', { class: 'egg', style: `filter: drop-shadow(0 0 10px ${(RARITY_INFO as any)[r].color})` }, '🥚');
  return h(
    'div',
    { class: 'col' },
    h('div', { class: 'f-title stroke', style: 'font-size:18px' }, `INCUBATEURS (${inc.length}/${MAX_INCUBATORS})`),
    h(
      'div',
      { class: 'row wrap' },
      inc.map((e) => {
        const ready = e.hatchAt <= now;
        const r = RARITY_INFO[e.rarity];
        return h(
          'div',
          { class: 'incubator panel', style: `--panel1:${r.color};--panel2:#2c1d66` },
          eggIcon(e.rarity),
          h('div', { class: 'f-title stroke small' }, r.name),
          ready
            ? btn('ÉCLORE !', 'green small', () => {
                const res = app.meta.beasts.hatch(e.uid);
                if (res) {
                  audio.sfx('rare');
                  haptics.rare();
                  const sp = getBeast(res.beast.speciesId);
                  showRewards(res.isNew ? 'NOUVELLE ESPÈCE !' : 'ÉCLOSION !', [{ reward: { type: 'beast', beastId: sp.id }, label: sp.name + (res.beast.mutation !== 'none' ? ' ' + MUT_ICON[res.beast.mutation] : ''), icon: '🐣', color: RARITY_INFO[sp.rarity].color, rarity: sp.rarity, isNew: res.isNew }], rerender);
                }
              })
            : h('div', { class: 'col center', style: 'gap:4px' }, h('div', { class: 'small stroke', 'data-until': String(e.hatchAt) }, fmtDuration(e.hatchAt - now)), btn(`⏩ ${app.meta.beasts.skipCost(e.uid)}💎`, 'purple small', () => (app.meta.beasts.skip(e.uid) ? rerender() : toast('Pas assez de gemmes', '💎')))),
        );
      }),
      Array.from({ length: MAX_INCUBATORS - inc.length }, () => h('div', { class: 'incubator panel dark' }, h('div', { style: 'font-size:40px;opacity:.4' }, '🪺'), h('div', { class: 'small muted' }, 'Libre'))),
    ),
    h('div', { class: 'f-title stroke', style: 'font-size:18px;margin-top:8px' }, `ŒUFS EN ATTENTE (${waiting.length})`),
    waiting.length
      ? h(
          'div',
          { class: 'row wrap' },
          waiting.map((e) => {
            const r = RARITY_INFO[e.rarity];
            return h(
              'div',
              { class: 'incubator panel', style: `--panel1:${r.color};--panel2:#2c1d66` },
              eggIcon(e.rarity),
              h('div', { class: 'f-title stroke small' }, r.name),
              h('div', { class: 'small muted' }, e.source === 'breed' ? 'Élevage' : e.source === 'match' ? 'Match' : 'Récompense'),
              btn('INCUBER', inc.length < MAX_INCUBATORS ? 'blue small' : 'gray small', () => (app.meta.beasts.incubate(e.uid) ? (audio.sfx('pickup'), rerender()) : toast('Incubateurs pleins', '🪺'))),
            );
          }),
        )
      : h('div', { class: 'small muted' }, 'Gagne des œufs en livrant des créatures en BEAST RUSH, dans les coffres, le Pass ou par élevage.'),
  );
}

function breeding(app: App, rerender: () => void) {
  const s = app.meta.state;
  const now = app.meta.now();
  const br = s.breeding;
  const box = h('div', { class: 'col' });
  box.appendChild(h('div', { class: 'small muted' }, 'Deux créatures ADULT ou plus, d’éléments identiques ou alliés, peuvent produire un œuf. Les mutations rendent les bébés plus rares… et les résultats rares existent !'));
  if (br) {
    const a = app.meta.beasts.get(br.a),
      b = app.meta.beasts.get(br.b);
    const ready = br.end <= now;
    box.appendChild(
      h(
        'div',
        { class: 'panel', style: 'padding:14px;text-align:center' },
        h('div', { class: 'row center' }, a ? portraits.beast(a.speciesId, a.stage, a.mutation) : '', h('div', { style: 'font-size:40px' }, '💞'), b ? portraits.beast(b.speciesId, b.stage, b.mutation) : ''),
        ready
          ? btn('🥚 RÉCUPÉRER L’ŒUF', 'green big', () => {
              const egg = app.meta.beasts.collectBreeding();
              if (egg) {
                audio.sfx('rare');
                showRewards('NOUVEL ŒUF !', [{ reward: { type: 'egg', rarity: egg.rarity }, label: `Œuf ${RARITY_INFO[egg.rarity].name}${egg.mutation !== 'none' ? ' ' + MUT_ICON[egg.mutation] : ''}`, icon: '🥚', color: RARITY_INFO[egg.rarity].color, rarity: egg.rarity, isNew: true }], rerender);
              }
            })
          : h('div', { class: 'f-title stroke', style: 'font-size:22px', 'data-until': String(br.end) }, fmtDuration(br.end - now)),
      ),
    );
    box.querySelectorAll('img').forEach((i) => ((i as HTMLImageElement).style.cssText = 'width:110px;height:110px;object-fit:contain'));
    return box;
  }
  let pick: string[] = [];
  const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(104px,1fr))' });
  const status = h('div', { class: 'f-title stroke', style: 'font-size:16px' }, 'Choisis 2 parents');
  const go = btn('💞 LANCER L’ÉLEVAGE', 'gray', () => {
    if (pick.length !== 2) return;
    if (app.meta.beasts.startBreeding(pick[0], pick[1])) {
      audio.sfx('heal');
      rerender();
    }
  });
  const upd = () => {
    grid.innerHTML = '';
    const eligible = s.beasts.filter((x) => x.stage >= 2);
    if (!eligible.length) grid.appendChild(h('div', { class: 'small muted' }, 'Aucune créature ADULT. Fais évoluer tes créatures (niveau 10 + énergie) !'));
    for (const b of eligible) {
      const c = beastCard(b, () => {
        if (pick.includes(b.uid)) pick = pick.filter((x) => x !== b.uid);
        else if (pick.length < 2) pick.push(b.uid);
        upd();
      });
      if (pick.includes(b.uid)) c.style.outline = '4px solid #ffe760';
      if (b.breedReadyAt > now) c.style.opacity = '0.5';
      grid.appendChild(c);
    }
    if (pick.length === 2) {
      const a = app.meta.beasts.get(pick[0])!,
        b = app.meta.beasts.get(pick[1])!;
      const chk = app.meta.beasts.canBreed(a, b);
      const ea = getBeast(a.speciesId).element,
        eb = getBeast(b.speciesId).element;
      status.textContent = chk.ok ? `✅ Compatible (${ELEMENT_INFO[ea].icon}+${ELEMENT_INFO[eb].icon}) · ${fmtDuration(app.meta.beasts.breedDuration(a, b))}` : `❌ ${chk.reason}`;
      go.className = 'btn ' + (chk.ok ? 'green' : 'gray');
      void compatible;
    } else {
      status.textContent = `Choisis 2 parents (${pick.length}/2)`;
      go.className = 'btn gray';
    }
  };
  upd();
  box.append(h('div', { class: 'row wrap' }, status, go), grid);
  return box;
}

function farm(app: App, rerender: () => void) {
  const s = app.meta.state;
  const now = app.meta.now();
  const plots = s.farm.map((p, i) => {
    if (!p.foodId)
      return h(
        'div',
        {
          class: 'farmplot',
          onclick: () => {
            const seeds = FOODS.filter((f) => (s.seeds[f.id] ?? 0) > 0);
            if (!seeds.length) return toast('Aucune graine : achète-en ci-dessous', '🌱');
            const mm = modal(h('div', { class: 'col center' }, h('h2', { class: 'stroke' }, 'PLANTER'), h('div', { class: 'row wrap center' }, seeds.map((f) => btn(`${f.icon} ${f.name} ×${s.seeds[f.id]} · ${f.growMinutes}min`, 'white small', () => (app.meta.beasts.plant(i, f.id), audio.sfx('pickup'), mm.close(), rerender()))))));
          },
        },
        h('div', { class: 'crop', style: 'opacity:.35' }, '🟫'),
        h('div', { class: 'small stroke' }, 'Planter'),
      );
    const f = FOOD_MAP[p.foodId];
    const ready = p.readyAt <= now;
    const k = Math.min(1, (now - p.plantedAt) / (p.readyAt - p.plantedAt));
    return h(
      'div',
      {
        class: 'farmplot' + (ready ? ' ready' : ''),
        onclick: () => {
          if (!ready) return toast(`${f.name} pousse encore…`, '🌱');
          const r = app.meta.beasts.harvest(i);
          if (r) {
            audio.sfx('coin');
            toast(`+${r.amount} ${r.food.name}`, r.food.icon, '#37b81c');
            rerender();
          }
        },
      },
      h('div', { class: 'crop', style: `transform:scale(${0.5 + k * 0.6})` }, ready ? f.icon : k < 0.5 ? '🌱' : '🌿'),
      ready ? h('div', { class: 'small stroke' }, 'RÉCOLTER') : h('div', { class: 'small stroke', 'data-until': String(p.readyAt) }, fmtDuration(p.readyAt - now)),
    );
  });
  return h(
    'div',
    { class: 'col' },
    h('div', { class: 'small muted' }, 'Cultive des fruits et plantes pour nourrir tes créatures. Les cultures poussent en temps réel, même hors ligne.'),
    h('div', { class: 'row wrap' }, plots),
    h('div', { class: 'section-title stroke' }, '🎒 INVENTAIRE'),
    h('div', { class: 'row wrap' }, FOODS.map((f) => chip(`${f.icon} ${s.food[f.id] ?? 0} · 🌱${s.seeds[f.id] ?? 0}`, '#3a2d7a'))),
    h('div', { class: 'section-title stroke' }, '🛒 GRAINES'),
    h('div', { class: 'row wrap' }, FOODS.map((f) => btn(`${f.icon} ${f.name} · 🪙${f.seedPrice}`, 'white small', () => (app.meta.beasts.buySeed(f.id) ? (audio.sfx('buy'), rerender()) : toast('Pas assez de coins', '🪙'))))),
  );
}
