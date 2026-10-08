type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub used to decouple game systems (quests, achievements, audio...) */
export class EventBus<M extends Record<string, any>> {
  private map = new Map<keyof M, Set<Handler<any>>>();
  on<K extends keyof M>(k: K, h: Handler<M[K]>): () => void {
    let s = this.map.get(k);
    if (!s) this.map.set(k, (s = new Set()));
    s.add(h);
    return () => s!.delete(h);
  }
  emit<K extends keyof M>(k: K, p: M[K]) {
    const s = this.map.get(k);
    if (s) for (const h of [...s]) h(p);
  }
}
