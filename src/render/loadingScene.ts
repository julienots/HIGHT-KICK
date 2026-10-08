import * as THREE from 'three';
import { getJacker } from '../data/jackers';
import { getBeast } from '../data/beasts';
import { makeSky } from './arenaView';
import { animateRig, buildCreature, buildEgg, type Rig } from './models';
import { makeLights, type Renderer } from './renderer';
import { glowTexture, toon } from './toon';

/** Key-art scene for the loading screen: heroes & creatures on a floating island around a giant egg. */
export class LoadingScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
  rigs: { rig: Rig; action: string; off: number }[] = [];
  egg: THREE.Group;
  t = 0;
  constructor(private renderer: Renderer) {
    this.scene.add(makeSky('#3a2aa8', '#ff9ad6'));
    makeLights(this.scene, '#fff0dc', '#c9b8ff', false);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(7, 6.5, 1, 40), toon('#7ed957'));
    island.position.y = -0.5;
    const under = new THREE.Mesh(new THREE.ConeGeometry(6.5, 8, 10), toon('#8a5a33'));
    under.rotation.x = Math.PI;
    under.position.y = -5;
    this.scene.add(island, under);
    this.egg = buildEgg('#ff5ad6', '#ffd23a', 1);
    this.egg.scale.setScalar(2.4);
    this.egg.position.set(0, 0, -1.5);
    this.scene.add(this.egg);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd23a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(9);
    glow.position.set(0, 1.8, -1.6);
    this.scene.add(glow);
    const cast: [string, number, number, string][] = [
      ['vex', -2.6, 0.8, 'victory'],
      ['boulder', 2.8, 0.2, 'flex'],
      ['oona', -4.6, -0.6, 'idle'],
      ['aero', 4.6, -0.8, 'idle'],
    ];
    for (const [id, x, z, action] of cast) {
      const j = getJacker(id);
      const rig = buildCreature(j.model, j.palette);
      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = -x * 0.08;
      this.scene.add(rig.root);
      this.rigs.push({ rig, action, off: x });
    }
    for (const [id, x, z] of [
      ['sproutle', -1.2, 2.2],
      ['flamby', 1.4, 2.4],
    ] as const) {
      const b = getBeast(id);
      const rig = buildCreature(b.model, b.palette);
      rig.model.scale.multiplyScalar(0.6);
      rig.scale *= 0.6;
      rig.root.position.set(x, 0, z);
      this.scene.add(rig.root);
      this.rigs.push({ rig, action: 'idle', off: x * 3 });
    }
  }
  update(dt: number) {
    this.t += dt;
    const t = this.t;
    this.egg.rotation.z = Math.sin(t * 6) * 0.06;
    this.egg.position.y = Math.abs(Math.sin(t * 2)) * 0.15;
    for (const r of this.rigs) animateRig(r.rig, { speed: 0, air: false, action: r.action, actionT: t + r.off, carrying: false, stunned: false, t: t + r.off, hurtT: 0, victory: r.action === 'flex' ? 'flex' : 'jump' }, dt);
    const a = this.renderer.aspect;
    this.camera.aspect = a;
    const d = a < 1 ? 20 : 13;
    this.camera.position.set(Math.sin(t * 0.15) * 2, 3.2, d);
    this.camera.lookAt(0, 1.4, 0);
    this.camera.updateProjectionMatrix();
  }
}
