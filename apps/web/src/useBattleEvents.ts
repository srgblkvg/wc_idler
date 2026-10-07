import { useEffect, useRef, useState } from 'react';
import type { CombatEvent, LootEvent, PublicPlayerState } from '@azeroth/game';
export function useBattleEvents(player: PublicPlayerState | null) {
  const [combat, setCombat] = useState<CombatEvent | null>(null);
  const [loot, setLoot] = useState<LootEvent | null>(null);
  const cursor = useRef<{ player: string; combat: number; loot: number } | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const cancelTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  };
  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
  };
  useEffect(() => {
    if (!player) {
      cancelTimers();
      cursor.current = null;
      setCombat(null);
      setLoot(null);
      return;
    }
    const combatEvents = player.combatEvents || [],
      lootEvents = player.lootEvents || [];
    const maxCombat = Math.max(0, ...combatEvents.map((e) => e.id)),
      maxLoot = Math.max(0, ...lootEvents.map((e) => e.id));
    if (cursor.current?.player !== player.id) {
      cancelTimers();
      cursor.current = { player: player.id, combat: maxCombat, loot: maxLoot };
      setCombat(null);
      setLoot(null);
      return;
    }
    const incoming = combatEvents
      .filter((e) => e.id > cursor.current!.combat)
      .sort((a, b) => a.id - b.id);
    incoming.slice(-5).forEach((event, index) =>
      later(() => {
        setCombat(event);
        later(() => setCombat((current) => (current?.id === event.id ? null : current)), 1100);
      }, index * 360),
    );
    const drops = lootEvents.filter((e) => e.id > cursor.current!.loot && !e.salvaged);
    if (drops.length) setLoot(drops[drops.length - 1]);
    cursor.current = { player: player.id, combat: maxCombat, loot: maxLoot };
  }, [player]);
  useEffect(() => () => cancelTimers(), []);
  return { combat, loot, dismissLoot: () => setLoot(null) };
}
