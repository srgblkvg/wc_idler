import { useEffect, useRef, type ReactNode } from 'react';
import { type CombatEvent, type MobId, type PublicPlayerState, MOB_BY_ID } from '@azeroth/game';
import { BATTLE_TIMING } from './battleTimeline';

function cardMotion(event: CombatEvent, side: 'player' | 'enemy'): Keyframe[] | null {
  const direction = side === 'player' ? 1 : -1;
  if (event.kind === 'attack' && event.source === side) {
    return [
      { transform: 'translateX(0) rotate(0)', offset: 0 },
      { transform: `translateX(${-direction * 3}px) rotate(${-direction * 3}deg)`, offset: 0.23 },
      { transform: `translateX(${direction * 12}px) rotate(${direction * 6}deg)`, offset: 0.41 },
      { transform: `translateX(${direction * 9}px) rotate(${direction * 4}deg)`, offset: 0.52 },
      { transform: `translateX(${-direction}px) rotate(${-direction}deg)`, offset: 0.83 },
      { transform: 'translateX(0) rotate(0)', offset: 1 },
    ];
  }
  if (event.kind === 'attack' && event.target === side) {
    if (event.missed) {
      return [
        { transform: 'translateX(0) rotate(0)', offset: 0 },
        { transform: 'translateX(0) rotate(0)', offset: 0.2 },
        { transform: `translateX(${-direction * 8}px) rotate(${-direction * 5}deg)`, offset: 0.4 },
        {
          transform: `translateX(${-direction * 7}px) rotate(${-direction * 4}deg)`,
          offset: 0.56,
        },
        { transform: 'translateX(0) rotate(0)', offset: 1 },
      ];
    }
    return [
      { transform: 'translateX(0) rotate(0)', offset: 0 },
      { transform: 'translateX(0) rotate(0)', offset: 0.39 },
      { transform: `translateX(${-direction * 7}px) rotate(${-direction * 3}deg)`, offset: 0.44 },
      { transform: `translateX(${direction * 3}px) rotate(${direction}deg)`, offset: 0.5 },
      { transform: `translateX(${-direction * 2}px) rotate(0)`, offset: 0.6 },
      { transform: 'translateX(0) rotate(0)', offset: 1 },
    ];
  }
  if (
    (event.kind === 'victory' && side === 'enemy') ||
    (event.kind === 'defeat' && side === 'player')
  ) {
    return [
      { transform: 'translateY(0) rotate(0)', opacity: 1 },
      { transform: `translateY(7px) rotate(${-direction * 4}deg)`, opacity: 0.48, offset: 0.35 },
      { transform: `translateY(7px) rotate(${-direction * 4}deg)`, opacity: 0.48, offset: 0.86 },
      { transform: 'translateY(0) rotate(0)', opacity: 1 },
    ];
  }
  return null;
}

export function BattleCard({
  side,
  name,
  level,
  combat,
  ward = false,
  children,
}: {
  side: 'player' | 'enemy';
  name: string;
  level: number;
  combat: CombatEvent | null;
  ward?: boolean;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  const hit = combat?.kind === 'attack' && combat.target === side;
  const defeated =
    combat &&
    ((combat.kind === 'victory' && side === 'enemy') ||
      (combat.kind === 'defeat' && side === 'player'));
  const healing = combat?.kind === 'heal' && combat.target === side;
  const action = defeated
    ? 'defeated'
    : healing
      ? 'heal'
      : hit
        ? combat.missed
          ? 'dodge'
          : 'hit'
        : combat?.kind === 'attack' && combat.source === side
          ? 'attack'
          : ward
            ? 'ward'
            : 'idle';
  useEffect(() => {
    if (!combat || !card.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    const frames = cardMotion(combat, side);
    if (!frames) return;
    const animation = card.current.animate(frames, {
      duration: BATTLE_TIMING[combat.kind],
      easing: 'linear',
    });
    return () => animation.cancel();
  }, [combat?.id, side]);

  return (
    <div
      className={`fighter ${side === 'player' ? 'hero-fighter' : 'foe-fighter'}`}
      data-testid={`combat-card-${side}`}
      data-side={side}
      data-action={action}
      data-event-id={combat?.id}
    >
      <div className="fighter-card" ref={card}>
        <div className="fighter-portrait">
          <span className="card-level" title={`Уровень ${level}`}>
            {level}
          </span>
          {children}
          {ward && <span className="card-aura ward-aura" aria-label="Оберег" />}
          {healing && <span className="card-aura healing-aura" key={`heal-${combat.id}`} />}
          {hit && !combat.missed && (
            <span
              className={`card-impact ${combat.critical ? 'critical' : ''}`}
              key={`impact-${combat.id}`}
            />
          )}
          {defeated && (
            <span className="card-outcome">{side === 'enemy' ? 'Повержен' : 'Поражение'}</span>
          )}
        </div>
        <strong className="fighter-name">{name}</strong>
      </div>
      {hit && (
        <span
          className={`floating-damage ${combat.missed ? 'missed' : ''} ${combat.critical ? 'critical' : ''}`}
          key={`damage-${combat.id}`}
          aria-hidden="true"
        >
          {combat.missed ? 'Промах' : `−${combat.damage}`}
          {combat.critical && <small>Критический удар</small>}
        </span>
      )}
      {healing && (
        <span className="floating-damage heal" key={`healing-${combat.id}`} aria-hidden="true">
          +{combat.healing}
        </span>
      )}
    </div>
  );
}

/** Reconstructs the displayed enemy HP until the matching impact has happened. */
export function presentedEnemyHealth(
  player: PublicPlayerState,
  combat: CombatEvent | null,
  impacted: boolean,
  mobId: MobId,
): number {
  const mob = MOB_BY_ID[mobId];
  if (!combat || combat.mobId !== mobId)
    return player.encounter?.mobId === mobId ? player.encounter.hp : mob.hp;
  if (combat.kind === 'victory') return 0;
  const before = player.combatEvents.filter(
    (event) => event.mobId === mobId && event.id <= combat.id,
  );
  let boundary = -1;
  before.forEach((event, index) => {
    if (event.id < combat.id && (event.kind === 'victory' || event.kind === 'defeat'))
      boundary = index;
  });
  // Subtract forward when the encounter is retained; reversing lethal raw damage adds overkill HP.
  if (boundary >= 0 || before[0]?.id === 1) {
    let hp = mob.hp;
    for (const event of before.slice(boundary + 1)) {
      if (event.kind === 'attack' && event.target === 'enemy' && (event.id < combat.id || impacted))
        hp = Math.max(0, hp - event.damage);
    }
    return hp;
  }
  const following = player.combatEvents.filter(
    (event) => event.mobId === mobId && event.id >= combat.id,
  );
  const victory = following.find((event) => event.kind === 'victory');
  let hp = victory ? 0 : player.encounter?.mobId === mobId ? player.encounter.hp : mob.hp;
  for (const event of following) {
    if (victory && event.id >= victory.id) break;
    if (event.kind === 'attack' && event.target === 'enemy' && (event.id > combat.id || !impacted))
      hp += event.damage;
  }
  return Math.max(0, Math.min(mob.hp, hp));
}
