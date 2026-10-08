import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/** Haptic feedback with graceful fallback (Capacitor native → navigator.vibrate → nothing). */
export class HapticSystem {
  enabled = true;
  private last = 0;
  private fire(style: 'light' | 'medium' | 'heavy', ms: number) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.last < 60) return;
    this.last = now;
    try {
      Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy }).catch(() => this.vib(ms));
    } catch {
      this.vib(ms);
    }
  }
  private vib(p: number | number[]) {
    try {
      navigator.vibrate?.(p);
    } catch {
      /* ignore */
    }
  }
  attack() {
    this.fire('light', 8);
  }
  impact() {
    this.fire('medium', 18);
  }
  super() {
    this.fire('heavy', 40);
  }
  rare() {
    if (!this.enabled) return;
    try {
      Haptics.notification({ type: NotificationType.Success }).catch(() => this.vib([30, 40, 30, 40, 80]));
    } catch {
      this.vib([30, 40, 30, 40, 80]);
    }
  }
  victory() {
    if (!this.enabled) return;
    this.vib([20, 30, 20]);
  }
}
export const haptics = new HapticSystem();
