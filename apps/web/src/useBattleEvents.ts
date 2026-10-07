import { useCallback, useEffect, useRef, useState } from 'react';
import type { CombatEvent, LootEvent, PublicPlayerState } from '@azeroth/game';
import { BattleTimeline } from './battleTimeline';

export function useBattleEvents(player: PublicPlayerState | null, active = true) {
  const [combat, setCombat] = useState<CombatEvent | null>(null);
  const [loot, setLoot] = useState<LootEvent | null>(null);
  const timeline = useRef<BattleTimeline | null>(null);
  const latestPlayer = useRef(player);
  const latestActive = useRef(active);
  latestPlayer.current = player;
  latestActive.current = active;

  useEffect(() => {
    const current = new BattleTimeline(setCombat, setLoot);
    timeline.current = current;
    current.setVisible(!document.hidden);
    current.setActive(latestActive.current);
    current.synchronize(latestPlayer.current);
    const onVisibility = () => current.setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      current.dispose();
      timeline.current = null;
    };
  }, []);

  useEffect(() => timeline.current?.synchronize(player), [player]);
  useEffect(() => timeline.current?.setActive(active), [active]);
  const dismissLoot = useCallback(() => timeline.current?.dismissLoot(), []);
  return { combat, loot, dismissLoot };
}
