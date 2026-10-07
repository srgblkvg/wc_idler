import { useEffect, useState } from 'react';
import { CirclePause, Flame, MapPin, Sword, X } from './UiIcons';
import {
  ITEM_BY_ID,
  MOB_BY_ID,
  getEquipConflict,
  getDerivedStats,
  type CombatEvent,
  type LootEvent,
  type SkillId,
} from '@azeroth/game';
import { ItemSymbol, Meter, rarityNames } from './Common';
import { CharacterSprite, EnemySprite } from './CharacterSprite';
import { BattleCard, presentedEnemyHealth } from './BattleCards';
import { BATTLE_TIMING } from './battleTimeline';
import { SkillButton, SkillDetails } from './SkillControls';
import type { GameProps } from './GamePanels';
import './combat-animation.css';

export function BattlePanel({
  player,
  pending,
  act,
  combat,
  loot,
  dismissLoot,
  openBag,
}: GameProps & {
  combat: CombatEvent | null;
  loot: LootEvent | null;
  dismissLoot: () => void;
  openBag: () => void;
}) {
  const [skillDetails, setSkillDetails] = useState<SkillId | null>(null);
  const [impactId, setImpactId] = useState<number | null>(null);
  useEffect(() => {
    if (!combat) return;
    const timer = setTimeout(() => setImpactId(combat.id), BATTLE_TIMING.impact);
    return () => clearTimeout(timer);
  }, [combat?.id]);
  const stats = getDerivedStats(player);
  const mobId =
    combat?.mobId ??
    player.encounter?.mobId ??
    (player.mode === 'hunting' ? player.targetMobId : null);
  const mob = mobId ? MOB_BY_ID[mobId] : null;
  const drop = loot ? ITEM_BY_ID[loot.itemId] : null;
  const dropConflict = drop ? getEquipConflict(player, drop) : null;
  const ward =
    !!combat &&
    player.combatEvents.some(
      (event) =>
        event.kind === 'ward' && event.timestamp === combat.timestamp && event.id <= combat.id,
    );
  const defeated = combat?.kind === 'defeat';
  return (
    <section className="battle-panel">
      <div className="battle-heading">
        <span>
          <MapPin size={13} />
          {mob?.location || 'Берёзовый Брод'}
        </span>
        <span className={`mode-indicator ${player.mode}`}>
          {player.mode === 'hunting' ? 'Автобой' : player.mode === 'resting' ? 'Отдых' : 'Привал'}
          <i />
        </span>
      </div>
      <div data-testid="battle-scene" className={`battle-arena region-${mob?.id || 'camp'}`}>
        <div className="arena-mist" />
        <BattleCard
          side="player"
          name={player.name}
          level={player.level}
          combat={combat}
          ward={ward}
        >
          <CharacterSprite player={player} portrait />
        </BattleCard>
        {mob ? (
          <BattleCard side="enemy" name={mob.name} level={mob.level} combat={combat}>
            <EnemySprite mobId={mob.id} />
          </BattleCard>
        ) : (
          <div className="camp-place" role="img" aria-label="Костёр">
            <div className="camp-embers">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        {combat?.kind === 'victory' && mob && (
          <span className="arena-result" key={combat.id}>
            +{mob.xp} опыта · {mob.copper} меди
          </span>
        )}
        {loot && drop && (
          <div
            data-testid="loot-notice"
            data-instance-id={loot.instanceId}
            key={loot.id}
            className={`loot-notice rarity-${drop.rarity}`}
            role="status"
          >
            <ItemSymbol item={drop} />
            <div className="loot-notice-copy">
              <small>
                {rarityNames[drop.rarity]}
                {loot.source === 'quest' ? ' · награда' : ''}
              </small>
              <strong>{drop.name}</strong>
              <div className="loot-actions">
                {loot.instanceId && (
                  <button
                    disabled={
                      pending ||
                      !!dropConflict ||
                      Object.values(player.equipment).includes(loot.instanceId)
                    }
                    title={dropConflict || undefined}
                    onClick={async () => {
                      if (await act({ type: 'equip', itemInstanceId: loot.instanceId! }))
                        dismissLoot();
                    }}
                  >
                    Надеть
                  </button>
                )}
                <button onClick={openBag}>В сумку</button>
              </div>
            </div>
            <button className="close-notice" onClick={dismissLoot} aria-label="Скрыть добычу">
              <X size={15} />
            </button>
          </div>
        )}
      </div>
      <div className="battle-hud">
        <div className="health-row">
          <Meter value={defeated ? 0 : player.hp} max={stats.maxHp} label="Здоровье" />
          <div className="opponent-meter">
            {mob ? (
              <Meter
                value={presentedEnemyHealth(player, combat, impactId === combat?.id, mob.id)}
                max={mob.hp}
                tone="enemy"
                label={mob.name}
              />
            ) : (
              <span className="camp-status">
                {player.mode === 'resting' ? 'Восстановление сил' : 'У костра'}
              </span>
            )}
          </div>
        </div>
        <div className="battle-power-row">
          <Meter value={player.mana} max={stats.maxMana} tone="power" label="Сила" />
        </div>
        <div className="battle-actions-row">
          <div className="skill-hud">
            {player.skills.loadout.map((id) => (
              <SkillButton
                key={id}
                id={id}
                cooldown={player.skills.cooldowns[id]}
                active={combat?.ability === id}
                onClick={() => setSkillDetails(id)}
              />
            ))}
          </div>
          <div className="battle-controls">
            {player.mode === 'hunting' ? (
              <button
                className="button primary"
                disabled={pending}
                onClick={() => void act({ type: 'stopHunt' })}
              >
                <CirclePause size={16} />
                <span>Стоп</span>
              </button>
            ) : (
              <button
                className="button primary"
                disabled={pending || player.mode === 'resting'}
                onClick={() => void act({ type: 'startHunt', mobId: player.targetMobId || 'wolf' })}
              >
                <Sword size={16} />
                <span>{player.mode === 'resting' ? 'Отдых' : 'В бой'}</span>
              </button>
            )}
            <button
              className="button rest-control"
              disabled={pending || player.mode === 'resting'}
              onClick={() => void act({ type: 'rest' })}
              aria-label="Отдых у костра"
              title="Отдых у костра"
            >
              <Flame size={17} />
            </button>
          </div>
        </div>
      </div>
      {skillDetails && <SkillDetails id={skillDetails} onClose={() => setSkillDetails(null)} />}
    </section>
  );
}
