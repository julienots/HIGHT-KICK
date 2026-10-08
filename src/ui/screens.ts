import type { App } from './app';
import { HomeScreen } from './home';
import { JackerDetail, JackersScreen } from './jackers';
import { BeastsScreen } from './beasts';
import { ChestsScreen } from './chests';
import { ShopScreen } from './shop';
import { PassScreen } from './pass';
import { QuestsScreen } from './quests';
import { EventsScreen } from './events';
import { ProfileScreen } from './profile';
import { SettingsScreen } from './settings';

export function registerScreens(app: App) {
  app.register('home', HomeScreen);
  app.register('jackers', JackersScreen);
  app.register('jacker', JackerDetail);
  app.register('beasts', BeastsScreen);
  app.register('chests', ChestsScreen);
  app.register('shop', ShopScreen);
  app.register('pass', PassScreen);
  app.register('quests', QuestsScreen);
  app.register('events', EventsScreen);
  app.register('profile', ProfileScreen);
  app.register('settings', SettingsScreen);
}
