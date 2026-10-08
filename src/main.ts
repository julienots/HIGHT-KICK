import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles.css';
import { App } from './ui/app';
import { playStudioIntro } from './ui/splash';
import { runLoading } from './ui/loading';
import { registerScreens } from './ui/screens';
import { App as CapApp } from '@capacitor/app';

async function boot() {
  const ui = document.getElementById('ui')!;
  const app = new App();
  (window as any).__bg = app; // debug/e2e hook
  registerScreens(app);
  const skipIntro = new URLSearchParams(location.search).has('nointro');
  if (!skipIntro) await playStudioIntro(ui);
  await runLoading(app, skipIntro);
  app.start();
  // Android hardware back button: pause in match, navigate back in menus, never quit by accident
  CapApp.addListener('backButton', () => {
    const modalBack = document.querySelector('.modal-back') as HTMLElement | null;
    if (modalBack) return modalBack.remove();
    if (app.match) return app.match.hud.pause(!app.match.paused);
    if (app.screenStack.length && app.screen && !app.screen.el.classList.contains('home')) app.back();
  }).catch(() => {});
  CapApp.addListener('pause', () => app.meta.flush()).catch(() => {});
}

boot().catch((e) => {
  console.error(e);
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;inset:0;color:#fff;background:#300;padding:20px;white-space:pre-wrap;z-index:999';
  el.textContent = 'BEAST GRAVITY — erreur au démarrage\n\n' + (e?.stack ?? e);
  document.body.appendChild(el);
});
