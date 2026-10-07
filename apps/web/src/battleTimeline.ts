import type { CombatEvent, LootEvent, PublicPlayerState } from '@azeroth/game';

export type BattleSnapshot = Pick<
  PublicPlayerState,
  'id' | 'targetMobId' | 'combatEvents' | 'lootEvents' | 'inventory' | 'equipment'
>;

export const BATTLE_TIMING = {
  attack: 820,
  heal: 720,
  ward: 620,
  victory: 820,
  defeat: 980,
  impact: 330,
} as const;

type PendingEvent = { kind: 'combat'; event: CombatEvent } | { kind: 'loot'; event: LootEvent };

/** Presents server events in order; it never calculates or changes combat outcomes. */
export class BattleTimeline {
  private snapshot: BattleSnapshot | null = null;
  private combatCursor = 0;
  private lootCursor = 0;
  private pending: PendingEvent[] = [];
  private notices: LootEvent[] = [];
  private notice: LootEvent | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private visible = true;
  private active = true;
  private ignoreThrough = -Infinity;
  private combatIgnoreThrough = -Infinity;
  private disposed = false;

  constructor(
    private readonly onCombat: (event: CombatEvent | null) => void,
    private readonly onLoot: (event: LootEvent | null) => void,
  ) {}

  synchronize(player: BattleSnapshot | null, now = Date.now()): void {
    if (this.disposed) return;
    const changedPlayer = player?.id !== this.snapshot?.id;
    const changedRegion = player?.targetMobId !== this.snapshot?.targetMobId;
    if (!player || changedPlayer) {
      this.clearCombat();
      this.notices = [];
      this.notice = null;
      this.onLoot(null);
      this.snapshot = player;
      this.combatCursor = Math.max(0, ...(player?.combatEvents.map((event) => event.id) ?? []));
      this.lootCursor = Math.max(0, ...(player?.lootEvents.map((event) => event.id) ?? []));
      return;
    }

    if (changedRegion) this.clearCombat();
    this.snapshot = player;
    const combat = player.combatEvents.filter((event) => event.id > this.combatCursor);
    const drops = player.lootEvents.filter(
      (event) => event.id > this.lootCursor && !event.salvaged,
    );
    this.combatCursor = Math.max(this.combatCursor, ...combat.map((event) => event.id));
    this.lootCursor = Math.max(this.lootCursor, ...player.lootEvents.map((event) => event.id));
    if (!this.visible) return;

    // A resumed tab can receive hours of simulation. Only the latest live turn is animated.
    const latestTurn = Math.max(0, ...combat.map((event) => event.timestamp));
    const recentCombat = combat.filter(
      (event) =>
        this.active &&
        event.mobId === player.targetMobId &&
        event.timestamp > this.ignoreThrough &&
        event.timestamp > this.combatIgnoreThrough &&
        event.timestamp >= Math.max(now - 10_000, latestTurn - 3_000),
    );
    const recentDrops = drops.filter(
      (event) => event.timestamp > this.ignoreThrough && event.timestamp >= now - 10_000,
    );
    const incoming: PendingEvent[] = [
      ...recentCombat.map((event) => ({ kind: 'combat' as const, event })),
      ...recentDrops.map((event) => ({ kind: 'loot' as const, event })),
    ];
    this.pending = [...this.pending, ...incoming]
      .sort((a, b) => a.event.id - b.event.id)
      .slice(-12);
    this.drain();
  }

  dismissLoot(): void {
    this.notice = null;
    this.onLoot(null);
    this.nextNotice();
  }

  setVisible(visible: boolean): void {
    if (visible && !this.visible) this.ignoreThrough = Date.now();
    this.visible = visible;
    if (!visible) this.clearCombat();
  }

  setActive(active: boolean): void {
    if (active && !this.active) this.combatIgnoreThrough = Date.now();
    this.active = active;
    if (!active) this.clearCombat(true);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = [];
    this.notices = [];
  }

  private clearCombat(keepLoot = false): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = keepLoot ? this.pending.filter((entry) => entry.kind === 'loot') : [];
    this.onCombat(null);
    if (keepLoot) this.drain();
  }

  private drain(): void {
    if (this.timer !== null || this.disposed || !this.visible) return;
    while (this.pending.length) {
      const next = this.pending.shift()!;
      if (next.kind === 'loot') {
        if (
          this.notice?.instanceId !== next.event.instanceId &&
          !this.notices.some((notice) => notice.instanceId === next.event.instanceId)
        ) {
          this.notices.push(next.event);
          this.notices = this.notices.slice(-5);
          this.nextNotice();
        }
        continue;
      }
      if (!this.active || next.event.mobId !== this.snapshot?.targetMobId) continue;
      this.onCombat(next.event);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.onCombat(null);
        this.drain();
      }, BATTLE_TIMING[next.event.kind]);
      return;
    }
  }

  private nextNotice(): void {
    if (this.notice || !this.snapshot) return;
    while (this.notices.length) {
      const next = this.notices.shift()!;
      if (
        !next.instanceId ||
        !this.snapshot.inventory.some((item) => item.instanceId === next.instanceId) ||
        Object.values(this.snapshot.equipment).includes(next.instanceId)
      )
        continue;
      this.notice = next;
      this.onLoot(next);
      return;
    }
  }
}
