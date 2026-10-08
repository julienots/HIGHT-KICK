import { expect, test, type Page } from '@playwright/test';

/** Every request must stay on the local origin: the game may never depend on the Internet. */
async function forbidInternet(page: Page) {
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    external.push(u.href);
    return route.abort();
  });
  return external;
}

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?nointro');
  await page.waitForFunction(() => !!(window as any).__bg?.screen, null, { timeout: 60_000 });
  // first launch of the day shows the login reward popup: claim it
  const gift = page.getByText('SUPER !');
  await gift.waitFor({ timeout: 5_000 }).then(() => gift.click(), () => {});
  await page.evaluate(() => document.querySelectorAll('.modal-back').forEach((m) => m.remove()));
}

test('launches with no network access and shows the main menu', async ({ page, context }) => {
  const errors: string[] = [];
  const external = await forbidInternet(page);
  await boot(page, errors);
  await context.setOffline(true);
  await expect(page.locator('.playbtn')).toBeVisible();
  await expect(page.locator('.hero-name')).toHaveText(/VEX/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('studio intro and loading screen play before the menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.splash')).toBeVisible();
  await expect(page.locator('.loading .logo')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.tap')).toBeVisible({ timeout: 20_000 });
  await page.mouse.click(640, 600);
  await expect(page.locator('.playbtn')).toBeVisible();
  await expect(page.getByText('CONNEXION')).toBeVisible();
  expect(errors).toEqual([]);
});

test('all main menu buttons open working screens', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  const navs = ['SHOP', 'PASS', 'QUESTS', 'EVENTS', 'JACKERS', 'BEASTS', 'COFFRES', 'PROFIL'];
  for (const n of navs) {
    await page.locator('.navbtn', { hasText: n }).click();
    await expect(page.locator('.screen')).toBeVisible();
    await page.locator('.btn.back').first().click();
    await expect(page.locator('.playbtn')).toBeVisible();
  }
  // jacker detail + upgrade + select
  await page.evaluate(() => {
    const a = (window as any).__bg;
    a.meta.state.currencies.coins = 9999;
    a.meta.state.jackers.boulder.shards = 999;
    a.go('jacker', { id: 'boulder' });
  });
  await page.getByText('AMÉLIORER').click();
  await expect.poll(() => page.evaluate(() => (window as any).__bg.meta.state.jackers.boulder.level)).toBe(2);
  await page.getByText('CHOISIR').click();
  await expect.poll(() => page.evaluate(() => (window as any).__bg.meta.state.profile.selectedJacker)).toBe('boulder');
  expect(errors).toEqual([]);
});

test('a full match can be played offline, rewards are granted and saved', async ({ page, context }) => {
  const errors: string[] = [];
  await forbidInternet(page);
  await boot(page, errors);
  await context.setOffline(true);
  const before = await page.evaluate(() => (window as any).__bg.meta.state.currencies.coins);
  await page.locator('.playbtn').click();
  await expect(page.locator('.hud')).toBeVisible();
  // real touch-style input: move with the keyboard and attack
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  await page.keyboard.up('w');
  await page.keyboard.press(' ');
  // let the AI drive the player and fast-forward
  await page.evaluate(() => {
    const a = (window as any).__bg;
    a.debugAutoplay();
    a.timeScale = 8;
  });
  await expect(page.locator('.results')).toBeVisible({ timeout: 200_000 });
  const res = await page.evaluate(() => {
    const m = (window as any).__bg.meta;
    return { coins: m.state.currencies.coins, matches: m.state.stats.matches, pass: m.state.pass.xp };
  });
  expect(res.matches).toBe(1);
  expect(res.coins).toBeGreaterThan(before);
  expect(res.pass).toBeGreaterThan(0);
  await page.getByText('CONTINUER').click();
  await expect(page.locator('.playbtn')).toBeVisible();
  // simulated app restart: progression persists
  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__bg?.screen);
  const after = await page.evaluate(() => (window as any).__bg.meta.state.stats.matches);
  expect(after).toBe(1);
  expect(errors).toEqual([]);
});

test('chest opening grants rewards', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => {
    const a = (window as any).__bg;
    a.meta.state.chests = ['gold'];
    a.go('chests');
  });
  const opened0 = await page.evaluate(() => (window as any).__bg.meta.state.stats.chestsOpened ?? 0);
  await page.getByText('OUVRIR', { exact: true }).click();
  const stage = page.locator('.chest-stage');
  await expect(stage).toBeVisible();
  for (let i = 0; i < 20 && !(await page.getByText('SUPER !').isVisible()); i++) {
    await stage.click({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(500);
  }
  await page.getByText('SUPER !').click();
  const opened = await page.evaluate(() => (window as any).__bg.meta.state.stats.chestsOpened);
  expect(opened).toBe(opened0 + 1);
  expect(errors).toEqual([]);
});

test('every game mode starts and runs', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  for (const mode of ['beast_rush', 'gravity_war', 'beast_hunt', 'boss_raid', 'survival', 'duel', 'chaos']) {
    await page.evaluate((m) => {
      const a = (window as any).__bg;
      if (a.match) a.quitMatch();
      a.meta.state.level = 10;
      a.play({ mode: m });
      a.debugAutoplay();
      a.timeScale = 4;
    }, mode);
    await expect.poll(() => page.evaluate(() => (window as any).__bg.match?.world.time ?? 0), { timeout: 60_000 }).toBeGreaterThan(3);
  }
  expect(errors).toEqual([]);
});
