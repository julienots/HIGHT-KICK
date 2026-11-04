import { dailyReward } from '../systems/progression';
import type { GrantedItem } from '../systems/ctx';
import type { App } from './app';
import { btn, h, modal, rewardItems } from './dom';
import { rewardVisual } from './pass';

export const GAME_VERSION = '2.0.0';

/** "Quoi de neuf" popup shown once after the Renaissance update. */
export function showNews(app: App, onClose: () => void) {
  const s = app.meta.state;
  if (s.seenVersion === GAME_VERSION) return onClose();
  s.seenVersion = GAME_VERSION;
  app.meta.dirty();
  const li = (t: string) => h('li', null, t);
  const m = modal(
    h(
      'div',
      { class: 'col' },
      h('h2', { class: 'stroke-l', style: 'font-size:30px;color:#ffd23a' }, '✨ MISE À JOUR 2.0 · RENAISSANCE ✨'),
      h(
        'ul',
        { class: 'newsbox small' },
        li('🧑‍🚀 10 nouveaux Jackers : RIPTIDE, SPROCKET, LUNA, MAGMOR, WISP, TUNDRA, PETAL, ORBIX, STATIK, GALE'),
        li('🐾 30 nouvelles créatures (80 au total) et 5 nouvelles arènes : Mushroom Grove, Coral Dome, Neon Skyline, Sunscorch Dunes, Celestial Sanctum'),
        li('👑 Nouveaux modes : CORE KING, NEST SIEGE et ENTRAÎNEMENT'),
        li('💜 ÉVEIL : au niveau 16, charge une jauge et déchaîne ton Jacker (vitesse, dégâts, super instantané)'),
        li('🐾 Compagnons : ta créature favorite combat maintenant à tes côtés en match !'),
        li('⚔️ BEAST ARENA : combats de créatures et tour de 30 étages'),
        li('☄️ COMÈTES : une récompense surprise après tes victoires, qui peut évoluer jusqu’à LÉGENDAIRE'),
        li('🎖️ Maîtrise de chaque Jacker, 🛡️ Clubs, 🏆 Classement, 📅 calendrier de connexion'),
        li('🎁 Cadeau de bienvenue : 3 Comètes !'),
      ),
      btn('C’EST PARTI !', 'green big', () => m.close()),
    ),
    { onClose },
  );
}

/** Daily login reward with a 7-day calendar. */
export function showDailyCalendar(app: App, streak: number, gift: GrantedItem[]) {
  const day = ((streak - 1) % 7) + 1;
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = i + 1;
    const r = dailyReward(d)[0];
    const v = rewardVisual(r);
    return h('div', { class: 'calday' + (d < day ? ' done' : d === day ? ' today' : '') }, h('b', null, `J${d}`), h('div', { style: 'font-size:22px' }, typeof v.icon === 'string' ? v.icon : '🎁'), h('div', null, d === 4 || d === 7 ? '+☄️' : v.label));
  });
  const m = modal(h('div', { class: 'col center' }, h('h2', { class: 'stroke' }, `CONNEXION — JOUR ${streak}`), h('div', { class: 'calendar' }, cells), rewardItems(gift), btn('SUPER !', 'green', () => m.close())));
}
