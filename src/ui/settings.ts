import { audio } from '../audio/audio';
import { DIFFICULTIES, DIFFICULTY_INFO } from '../data/modes';
import type { Settings } from '../systems/state';
import type { App, Screen } from './app';
import { btn, confirmModal, h, modal, toast } from './dom';
import { screenWithTabs } from './common';

export function SettingsScreen(app: App): Screen {
  const wrap = h('div', { style: 'position:absolute;inset:0' });
  const render = () => {
    const s = app.meta.state;
    const st = s.settings;
    const save = () => {
      app.meta.dirty();
      app.applySettings();
    };
    const opt = <K extends keyof Settings>(label: string, key: K, values: { v: Settings[K]; l: string }[], onChange?: () => void) =>
      h(
        'div',
        { class: 'setting' },
        h('div', { class: 'f-title stroke' }, label),
        h(
          'div',
          { class: 'opts' },
          values.map((x) =>
            btn(x.l, st[key] === x.v ? 'small' : 'gray small', () => {
              st[key] = x.v;
              save();
              onChange?.();
              render();
            }),
          ),
        ),
      );
    const slider = (label: string, key: 'music' | 'sfx') => {
      const inp = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(st[key]) }) as HTMLInputElement;
      inp.addEventListener('input', () => {
        st[key] = +inp.value;
        save();
      });
      inp.addEventListener('change', () => audio.sfx('click'));
      return h('div', { class: 'setting' }, h('div', { class: 'f-title stroke' }, label), inp);
    };
    const onoff = [
      { v: true, l: 'ON' },
      { v: false, l: 'OFF' },
    ];
    const body = h(
      'div',
      { class: 'screen-body' },
      h('div', { class: 'section-title stroke' }, '🔊 AUDIO & SENSATIONS'),
      slider('🎵 Musique', 'music'),
      slider('🔊 Effets sonores', 'sfx'),
      opt('📳 Vibrations', 'haptics', onoff as any),
      h('div', { class: 'section-title stroke' }, '🎮 CONTRÔLES'),
      opt('🎯 Visée', 'aim', [
        { v: 'auto', l: 'AUTO (débutant)' },
        { v: 'manual', l: 'MANUELLE (expert)' },
      ]),
      opt('🤖 Difficulté des bots', 'difficulty', DIFFICULTIES.map((d) => ({ v: d, l: DIFFICULTY_INFO[d].name }))),
      opt('🔢 Nombres de dégâts', 'damageNumbers', onoff as any),
      opt('📷 Tremblement caméra', 'screenShake', onoff as any),
      h('div', { class: 'section-title stroke' }, '📱 GRAPHISMES & PERFORMANCES'),
      opt(
        '✨ Qualité',
        'quality',
        [
          { v: 'low', l: 'LOW' },
          { v: 'medium', l: 'MEDIUM' },
          { v: 'high', l: 'HIGH' },
          { v: 'ultra', l: 'ULTRA' },
        ],
        () => app.setQuality(st.quality, st.performance),
      ),
      opt('⚡ Performance mode', 'performance', onoff as any, () => app.setQuality(st.quality, st.performance)),
      opt('📈 Afficher les FPS', 'showFps', onoff as any),
      h('div', { class: 'small muted' }, 'LOW/PERFORMANCE : résolution réduite, sans ombres ni contours, moins de particules et de décor. ULTRA : pleine résolution + ombres douces.'),
      h('div', { class: 'section-title stroke' }, '💾 SAUVEGARDE (LOCALE, HORS LIGNE)'),
      h('div', { class: 'setting' }, h('div', { class: 'small' }, `Sauvegarde sécurisée : double emplacement + 3 copies de secours + somme de contrôle · version ${s.version} · ${app.meta.save.seq} écritures`)),
      h(
        'div',
        { class: 'row wrap' },
        btn('💾 SAUVEGARDER', 'green small', () => (app.meta.saveNow(), toast('Progression sauvegardée', '💾'))),
        btn('📤 EXPORTER', 'blue small', () => {
          const code = app.meta.save.exportString(s);
          const ta = h('textarea', { style: 'width:100%;height:120px;font-size:11px;user-select:text;-webkit-user-select:text' }, code) as HTMLTextAreaElement;
          modal(h('div', { class: 'col' }, h('h2', { class: 'stroke' }, 'CODE DE SAUVEGARDE'), h('div', { class: 'small' }, 'Copie ce code pour transférer ta progression sur un autre appareil.'), ta, btn('COPIER', 'green', () => navigator.clipboard?.writeText(code).then(() => toast('Copié !', '📋'), () => ta.select()))));
        }),
        btn('📥 IMPORTER', 'blue small', () => {
          const ta = h('textarea', { style: 'width:100%;height:120px;font-size:11px;user-select:text;-webkit-user-select:text' }) as HTMLTextAreaElement;
          const m = modal(
            h(
              'div',
              { class: 'col' },
              h('h2', { class: 'stroke' }, 'IMPORTER'),
              ta,
              btn('IMPORTER', 'green', () => {
                const st2 = app.meta.save.importString(ta.value);
                if (!st2) return toast('Code invalide ou corrompu', '❌');
                app.meta.state = st2;
                app.meta.saveNow();
                location.reload();
                m.close();
              }),
            ),
          );
        }),
        btn('🗑️ RÉINITIALISER', 'red small', () =>
          confirmModal('Tout effacer ?', 'Toute ta progression locale sera supprimée définitivement.', 'EFFACER', () => {
            app.meta.save.wipe();
            location.reload();
          }, 'red'),
        ),
      ),
      h('div', { class: 'section-title stroke' }, '🌐 EN LIGNE'),
      h('div', { class: 'setting' }, h('div', { class: 'small' }, '📴 BEAST GRAVITY fonctionne entièrement hors ligne. Les fonctionnalités en ligne (PvP, amis, clans, classements mondiaux, sauvegarde cloud) arriveront plus tard et resteront optionnelles.')),
      h('div', { class: 'section-title stroke' }, 'ℹ️ À PROPOS'),
      h('div', { class: 'setting' }, h('div', null, h('div', { class: 'f-title stroke', style: 'font-size:20px' }, 'BEAST GRAVITY v' + (import.meta.env.VITE_APP_VERSION ?? '0.1.0')), h('div', { class: 'small' }, '© SUPERESSENCE — Tous les personnages, créatures, arènes, sons et musiques sont des créations originales générées procéduralement.'))),
      h('div', { class: 'small muted' }, 'Clavier : ZQSD/WASD bouger · Clic/Espace attaque · E compétence · Q/R ou clic droit super · F interagir · G gadget · 1-4 emotes · Échap pause'),
    );
    wrap.innerHTML = '';
    wrap.appendChild(screenWithTabs(app, 'PARAMÈTRES', [], '', () => {}, body));
  };
  render();
  return { el: wrap, menu3d: false, refresh: render };
}
