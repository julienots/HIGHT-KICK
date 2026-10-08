/**
 * Online abstraction layer (future: matchmaking, PvP, friends, clans, leaderboards, cloud save).
 *
 * The solo game NEVER depends on this: every call has an offline implementation and failures are
 * swallowed. When a backend exists, `OnlineService` can be swapped for an HTTP/WebSocket client with
 * a server-authoritative match simulation (the deterministic `World` sim can run on the server as-is).
 */
export interface LeaderboardEntry {
  name: string;
  trophies: number;
  rank: number;
}
export interface OnlineService {
  readonly online: boolean;
  status(): Promise<'offline' | 'online'>;
  cloudSave(data: string): Promise<boolean>;
  cloudLoad(): Promise<string | null>;
  leaderboard(): Promise<LeaderboardEntry[]>;
  findMatch(mode: string): Promise<null>;
}

class OfflineService implements OnlineService {
  readonly online = false;
  async status() {
    return 'offline' as const;
  }
  async cloudSave() {
    return false;
  }
  async cloudLoad() {
    return null;
  }
  async leaderboard() {
    return [];
  }
  async findMatch() {
    return null;
  }
}

export const offlineService: OnlineService = new OfflineService();
