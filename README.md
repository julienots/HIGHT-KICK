# 🐾🧲 BEAST GRAVITY — by SUPERESSENCE

**3v3 Action Arena + Monster Collection + Gravity Combat** — jeu mobile 3D / 2.5D, **100 % jouable hors ligne**.

> Lance le jeu → choisis ton Jacker → joue immédiatement → récupère des créatures → gagne des récompenses → améliore ton personnage → débloque un skin → rejoue.

---

## ▶️ Lancer le jeu

```bash
npm install
npm run dev          # http://localhost:5173  (ajouter ?nointro pour sauter l'intro studio)
npm run build        # build web de production dans dist/
npm test             # tests unitaires + simulations de matchs complets (vitest)
npm run e2e          # tests navigateur (Playwright) : lancement hors ligne, menus, match complet, sauvegarde
```

### 📦 APK / AAB Android

Le projet natif Android (Capacitor 7) est dans `android/`.

```bash
npm run android:debug     # build web + cap sync + APK debug
npm run android:release   # APK release + AAB release
```

Sorties :
- `android/app/build/outputs/apk/debug/app-debug.apk`
- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

**CI GitHub Actions** (`.github/workflows/build.yml`) : à chaque push, tests (unitaires + e2e) puis build **APK Debug, APK Release et AAB Release** téléchargeables dans l'onglet *Actions → Artifacts*.
Signature release : ajouter les secrets `BG_KEYSTORE_BASE64`, `BG_KEYSTORE_PASSWORD`, `BG_KEY_ALIAS`, `BG_KEY_PASSWORD` (ou un fichier `android/keystore.properties` en local). Sans clé, la release est signée avec la clé debug pour rester installable en test.

Icônes et splash Android : `node scripts/gen-android-assets.mjs` (générés depuis l'art original `public/icon.svg`).

---

## 📴 Offline-first

- Tout est embarqué dans l'APK : code, polices (Lilita One / Nunito via @fontsource), modèles 3D **procéduraux**, VFX, **musique et sons synthétisés** (WebAudio) → aucun fichier distant, aucun appel réseau.
- Couper Wi-Fi + données → le jeu démarre et se joue normalement (testé par `tests/e2e/game.spec.ts`, qui bloque toute requête externe).
- Missions quotidiennes/hebdo, boutique du jour, saisons, événements, éclosion, élevage et ferme utilisent l'horloge de l'appareil.
- `src/online/service.ts` définit l'interface du futur online (matchmaking, PvP, amis, clans, classements, cloud save) avec une implémentation hors ligne. **Le online n'est jamais une dépendance du solo.** La simulation de match (`src/sim`) est déterministe (RNG seedé) et sans rendu : elle peut tourner telle quelle côté serveur (architecture serveur autoritaire).

## 💾 Sauvegarde sécurisée

`src/systems/save.ts` + `src/systems/state.ts`
- double emplacement A/B (une écriture ne remplace jamais la dernière bonne sauvegarde) + numéro de séquence ;
- somme de contrôle sur chaque sauvegarde (détection de corruption / modification) ;
- 3 copies de secours tournantes ;
- migrations de version + validation/réparation du schéma au chargement ;
- écriture différée + flush sur mise en arrière-plan / fermeture brutale ;
- export / import par code (Paramètres).

---

## 🎮 Contenu

| | |
|---|---|
| **Jackers** | 20 (VEX, BOULDER, OONA, AERO, VOLT + 15 originaux), 7 rôles, attaque / compétence / super / passif, niveaux 1→20, 2 gadgets, 2 star powers, 2 pouvoirs spéciaux, 4 skins chacun (80 skins) |
| **Créatures** | 50 espèces, 10 éléments (forces/faiblesses), 7 raretés, 5 stades (BABY→TITAN), mutations, nourriture préférée, élevage |
| **Arènes** | 10 arènes avec mécanique propre (buissons, éruptions, glace, portails, créatures sauvages, gravité faible, tempête, cristaux, plateformes, pièges) |
| **Modes** | BEAST RUSH, GRAVITY WAR, BEAST HUNT, BOSS RAID, SURVIVAL, DUEL, CHAOS + campagne 30 niveaux + événements tournants |
| **Gravité** | Gravity Core (événements de match) + Gravity Nodes : LOW, HEAVY, REVERSE, ORBIT, VORTEX, REPULSION |
| **Œufs** | EGG → HATCHLING → BEAST → ELITE → TITAN (1/2/4/7/12 pts) : livrer vite ou attendre l'évolution ? |
| **IA** | EASY / NORMAL / HARD / EXPERT / MASTER : réaction, visée, anticipation, esquive, usage des Nodes, coordination, stratégie d'œuf |
| **Méta** | niveau joueur, trophées + route des trophées, rangs Bronze→Legend, coffres (6), boutique (7 sections), SUPER PASS 50 paliers free/premium, missions (6 catégories), 73 succès, saisons |

## 🕹️ Contrôles

Mobile : joystick flottant à gauche · bouton rouge = attaque (toucher = visée auto, glisser = visée manuelle) · bleu = compétence · jaune = SUPER · vert = gadget · violet = Gravity Node.
Clavier : ZQSD/WASD · Espace/clic = attaque · E compétence · Q/R/clic droit super · F interagir · G gadget · 1-4 emotes · Échap pause.

---

## 🧱 Architecture

```
src/
  core/      rng seedé, maths, bus d'événements, temps
  data/      contenu : jackers, skins, beasts, arenas, modes, economy, quests, achievements, seasons, campaign
  sim/       simulation pure (sans rendu) — World, Grid (A*), abilities, ai (BotBrain), modes
  systems/   méta-jeu : save, state, rewards (+coffres), progression, beasts (œufs/élevage/ferme), live (quêtes, pass, boutique, succès, événements), meta (hub)
  render/    Three.js : modèles toon procéduraux + animations, arènes instanciées, VFX, caméra, scènes menu/chargement
  audio/     sons & musique procéduraux, haptique
  ui/        écrans DOM (accueil, jackers, beasts, coffres, boutique, pass, missions, événements, profil, paramètres), HUD, résultats, intro studio
  online/    interface future online (implémentation hors ligne)
```

Correspondance avec les systèmes demandés : CharacterSystem/AbilitySystem/CombatSystem/GravitySystem/EggSystem/ArenaSystem/MatchSystem → `sim/` ; BotSystem → `sim/ai.ts` ; BeastSystem/BreedingSystem/EvolutionSystem → `systems/beasts.ts` ; ProgressionSystem/LevelSystem/SeasonSystem → `systems/progression.ts` ; SkinSystem → `data/skins.ts` + jackers UI ; ShopSystem/PassSystem/QuestSystem/EventSystem → `systems/live.ts` ; ChestSystem/RewardSystem → `systems/rewards.ts` ; ProfileSystem → `ui/profile.ts` ; SaveSystem → `systems/save.ts` ; AudioSystem → `audio/` ; VFXSystem → `render/vfx.ts` ; UISystem → `ui/`.

## ⚙️ Optimisation

Qualité LOW / MEDIUM / HIGH / ULTRA + **Performance Mode** : résolution, ombres, contours, densité de particules et de décor. Sols/murs/caisses/buissons en `InstancedMesh`, personnages fusionnés par membre (≈ 10 draw calls / perso), pools de particules, simulation à pas fixe 60 Hz.

## ⚠️ Note technique

Le cahier des charges mentionnait Unity/C#. L'environnement de développement (cloud, sans éditeur Unity ni licence) ne permet ni de compiler ni de tester un projet Unity. Le jeu est donc construit en **TypeScript + Three.js**, empaqueté en application Android native avec **Capacitor** : il est réellement jouable, testé automatiquement, et produit des APK/AAB installables.

© SUPERESSENCE — personnages, créatures, arènes, logo, sons et musiques sont des créations originales.
