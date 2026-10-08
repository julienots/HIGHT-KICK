import * as THREE from 'three';
import { getBeast, STAGE_INFO, STAGES } from '../data/beasts';
import { getJacker } from '../data/jackers';
import { SKIN_MAP } from '../data/skins';
import { animateRig, buildCreature } from '../render/models';
import { mutatePalette } from '../render/mutation';

/** Renders 3D portraits of Jackers/creatures once into data URLs (cached) for menus and cards. */
class PortraitRenderer {
  private r: THREE.WebGLRenderer | null = null;
  private cache = new Map<string, string>();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private queue: { key: string; make: () => { obj: THREE.Object3D; height: number }; cb: (url: string) => void }[] = [];
  private busy = false;
  constructor() {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#5a4a8a', 1.4));
    const d = new THREE.DirectionalLight('#ffffff', 2.0);
    d.position.set(-2, 4, 5);
    this.scene.add(d);
  }
  private ensure() {
    if (this.r) return this.r;
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    this.r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.r.setPixelRatio(1);
    this.r.setSize(192, 192, false);
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    return this.r;
  }
  private render(obj: THREE.Object3D, height: number) {
    const r = this.ensure();
    this.scene.add(obj);
    const h = height;
    this.cam.position.set(0, h * 0.62, h * 2.35 + 0.6);
    this.cam.lookAt(0, h * 0.5, 0);
    r.setClearColor(0x000000, 0);
    r.render(this.scene, this.cam);
    const url = r.domElement.toDataURL('image/png');
    this.scene.remove(obj);
    obj.traverse((o: any) => o.geometry?.dispose?.());
    return url;
  }
  private pump() {
    if (this.busy) return;
    this.busy = true;
    const step = () => {
      const job = this.queue.shift();
      if (!job) {
        this.busy = false;
        return;
      }
      let url = this.cache.get(job.key);
      if (!url) {
        try {
          const m = job.make();
          url = this.render(m.obj, m.height);
        } catch {
          url = '';
        }
        this.cache.set(job.key, url);
      }
      job.cb(url);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  private request(key: string, img: HTMLImageElement, build: () => { obj: THREE.Object3D; height: number }) {
    const c = this.cache.get(key);
    if (c !== undefined) {
      img.src = c;
      return img;
    }
    this.queue.push({ key, make: build, cb: (u) => (img.src = u) });
    this.pump();
    return img;
  }
  jacker(id: string, skinId?: string, pose: 'idle' | 'victory' = 'idle') {
    const img = new Image();
    img.alt = id;
    img.draggable = false;
    const j = getJacker(id);
    const sk = skinId ? SKIN_MAP[skinId] : undefined;
    return this.request(`j:${id}:${skinId ?? ''}:${pose}`, img, () => {
      const rig = buildCreature(j.model, sk?.palette ?? j.palette, { accessory: sk?.accessory, glow: sk?.glow });
      rig.root.remove(rig.shadow);
      rig.root.rotation.y = -0.35;
      animateRig(rig, { speed: 0, air: false, action: pose === 'victory' ? 'victory' : 'idle', actionT: 0.3, carrying: false, stunned: false, t: 0.6, hurtT: 0, victory: 'flex' }, 0);
      return { obj: rig.root, height: rig.height };
    });
  }
  beast(speciesId: string, stage = 2, mutation = 'none') {
    const img = new Image();
    img.alt = speciesId;
    img.draggable = false;
    const sp = getBeast(speciesId);
    return this.request(`b:${speciesId}:${stage}:${mutation}`, img, () => {
      const rig = buildCreature(sp.model, mutatePalette(sp.palette, mutation), { accessory: stage >= 4 ? 'crown' : 'none', glow: stage >= 3 ? '#ffd23a' : undefined });
      rig.root.remove(rig.shadow);
      const s = STAGE_INFO[STAGES[stage]].scale;
      rig.model.scale.multiplyScalar(0.85 + s * 0.2);
      rig.root.rotation.y = -0.4;
      animateRig(rig, { speed: 0, air: false, action: 'idle', actionT: 0, carrying: false, stunned: false, t: 0.4, hurtT: 0 }, 0);
      return { obj: rig.root, height: rig.height * (0.85 + s * 0.2) };
    });
  }
}

export const portraits = new PortraitRenderer();
