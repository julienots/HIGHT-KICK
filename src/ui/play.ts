import { ARENAS } from '../data/arenas';
import { DIFFICULTIES, DIFFICULTY_INFO, MODES } from '../data/modes';
import type { App } from './app';
import { btn, h, modal, toast } from './dom';

export function openModeSelect(app: App, onDone: () => void) {
  const s = app.meta.state;
  const body = h('div', { class: 'col' });
  const render = () => {
    body.innerHTML = '';
    body.appendChild(h('h2', { class: 'stroke' }, 'CHOISIS TON MODE'));
    body.appendChild(
      h(
        'div',
        { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr))' },
        MODES.map((m) => {
          const unlocked = app.meta.progression.modeUnlocked(m.id);
          return h(
            'div',
            {
              class: 'modecard panel' + (app.selectedMode === m.id ? ' sel' : ''),
              style: `--panel1:${m.color};--panel2:#2c1d66`,
              onclick: () => {
                if (!unlocked) return toast(`Débloqué au niveau ${m.unlockLevel}`, '🔒');
                app.selectedMode = m.id;
                render();
              },
            },
            h('div', { class: 'mi' }, m.icon),
            h('div', { class: 'mt stroke' }, m.name),
            h('div', { class: 'small', style: 'font-weight:700' }, m.desc),
            h('div', { class: 'small muted' }, m.teamSize === 1 ? '1 vs 1' : m.id === 'boss_raid' ? '3 vs TITAN' : '3 vs 3'),
            !unlocked ? h('div', { class: 'lock-overlay' }, `🔒 Niveau ${m.unlockLevel}`) : null,
          );
        }),
      ),
    );
    body.appendChild(h('div', { class: 'section-title stroke' }, 'ARÈNE'));
    body.appendChild(
      h(
        'div',
        { class: 'row wrap' },
        btn('🎲 ALÉATOIRE', app.selectedArena === 'random' ? 'small' : 'gray small', () => ((app.selectedArena = 'random'), render())),
        ARENAS.map((a) => {
          const un = app.meta.progression.arenaUnlocked(a.id);
          return btn(`${String(a.num).padStart(2, '0')} ${a.name}${un ? '' : ` 🔒${a.unlockTrophies}🏆`}`, app.selectedArena === a.id ? 'small' : 'gray small', () => {
            if (!un) return toast(`Débloquée à ${a.unlockTrophies} trophées`, '🔒');
            app.selectedArena = a.id;
            render();
          });
        }),
      ),
    );
    body.appendChild(h('div', { class: 'section-title stroke' }, 'DIFFICULTÉ DES BOTS'));
    body.appendChild(
      h(
        'div',
        { class: 'diffrow' },
        DIFFICULTIES.map((d) =>
          btn(`${DIFFICULTY_INFO[d].name} ×${DIFFICULTY_INFO[d].rewardMult}`, s.settings.difficulty === d ? 'small' : 'gray small', () => {
            s.settings.difficulty = d;
            app.meta.dirty();
            render();
          }),
        ),
      ),
    );
    body.appendChild(h('div', { style: 'height:10px' }));
    body.appendChild(
      h(
        'div',
        { class: 'row center' },
        btn('OK', 'blue', () => m.close()),
        btn('JOUER !', 'green big', () => {
          m.close();
          app.play({ mode: app.selectedMode, arena: app.selectedArena });
        }),
      ),
    );
  };
  render();
  const m = modal(body, { onClose: onDone, cls: 'wide' });
  m.box.style.maxWidth = '820px';
}
