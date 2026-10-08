import { TIPS } from '../data/economy';
import { LoadingScene } from '../render/loadingScene';
import { audio } from '../audio/audio';
import type { App } from './app';
import { h } from './dom';
import { portraits } from './portraits';

/** Loading screen with key art, real warm-up steps, random gameplay tips and "tap to play". */
export function runLoading(app: App, fast = false): Promise<void> {
  return new Promise((resolve) => {
    const ui = document.getElementById('ui')!;
    const scene = new LoadingScene(app.renderer);
    const fill = h('i');
    const tip = h('div', { class: 'tip stroke' }, '💡 ' + TIPS[Math.floor(Math.random() * TIPS.length)]);
    const status = h('div', { class: 'small stroke', style: 'margin-top:6px;opacity:0.85' }, 'Chargement…');
    const tap = h('div', { class: 'tap stroke', style: 'visibility:hidden' }, 'TOUCHE POUR JOUER');
    const el = h(
      'div',
      { class: 'loading' },
      h('div', { class: 'logo' }, h('div', { class: 'l1' }, 'BEAST'), h('div', { class: 'l2' }, 'GRAVITY'), h('div', { class: 'l3 stroke' }, 'SUPERESSENCE')),
      h('div', { class: 'loadbox' }, tip, h('div', { class: 'loadbar' }, fill), status, tap),
    );
    ui.appendChild(el);
    let running = true;
    let last = performance.now();
    const loop = (t: number) => {
      if (!running) return;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      scene.update(dt);
      app.renderer.r.render(scene.scene, scene.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const tipTimer = setInterval(() => (tip.textContent = '💡 ' + TIPS[Math.floor(Math.random() * TIPS.length)]), 3500);
    const s = app.meta.state;
    // real warm-up steps (each yields a frame so the bar animates)
    const steps: [string, () => void][] = [
      ['Lecture de la sauvegarde locale', () => void app.meta.save.lastSource],
      ['Préparation du Gravity Core', () => app.menu.update(0.016)],
      ['Compilation des shaders', () => app.renderer.r.compile(app.menu.scene, app.menu.camera)],
      ['Réveil des Jackers', () => app.menu.setHero(s.profile.selectedJacker, s.jackers[s.profile.selectedJacker].skin)],
      ['Incubation des œufs', () => portraits.jacker(s.profile.avatar)],
      ['Synchronisation des quêtes (hors ligne)', () => app.meta.quests.refresh()],
      ['Prêt !', () => {}],
    ];
    let i = 0;
    const next = () => {
      if (i >= steps.length) {
        status.textContent = app.meta.save.lastSource === 'backup' ? '⚠️ Sauvegarde restaurée depuis une copie de secours' : `Mode hors ligne · ${app.meta.save.lastSource === 'new' ? 'nouvelle partie' : 'progression chargée'}`;
        const finish = () => {
          running = false;
          clearInterval(tipTimer);
          audio.unlock();
          audio.sfx('go');
          el.style.transition = 'opacity 0.3s';
          el.style.opacity = '0';
          setTimeout(() => {
            el.remove();
            resolve();
          }, 300);
        };
        if (fast) return finish();
        tap.style.visibility = 'visible';
        el.addEventListener('pointerdown', finish, { once: true });
        return;
      }
      const [label, fn] = steps[i];
      status.textContent = label + '…';
      try {
        fn();
      } catch (e) {
        console.warn(e);
      }
      i++;
      fill.style.width = `${(i / steps.length) * 100}%`;
      setTimeout(next, fast ? 0 : 160 + Math.random() * 140);
    };
    setTimeout(next, fast ? 0 : 300);
  });
}
