export type GravityType = 'normal' | 'low' | 'heavy' | 'reverse' | 'orbit' | 'vortex' | 'repulsion';

export const GRAVITY_INFO: Record<GravityType, { name: string; icon: string; color: string; desc: string }> = {
  normal: { name: 'NORMAL', icon: '⬇️', color: '#9fb4ff', desc: 'Gravité classique.' },
  low: { name: 'LOW GRAVITY', icon: '🪶', color: '#7dfcff', desc: 'Sauts plus hauts, chute plus lente.' },
  heavy: { name: 'HEAVY GRAVITY', icon: '🏋️', color: '#ff8a3d', desc: 'Déplacements ralentis.' },
  reverse: { name: 'REVERSE GRAVITY', icon: '🔺', color: '#ff5ad6', desc: 'Soulève les ennemis vers le ciel : ils lâchent tout.' },
  orbit: { name: 'ORBIT', icon: '🪐', color: '#ffd23a', desc: 'Fait tourner tout autour du Node.' },
  vortex: { name: 'VORTEX', icon: '🌀', color: '#8a4dff', desc: 'Aspire vers le centre.' },
  repulsion: { name: 'REPULSION', icon: '💥', color: '#4dff9a', desc: 'Repousse violemment.' },
};
