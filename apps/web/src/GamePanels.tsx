import { useState } from 'react';
import { Check } from './UiIcons';
import {
  ITEM_BY_ID,
  MOB_BY_ID,
  QUESTS,
  EQUIPMENT_SLOTS,
  getAvailableSkills,
  getEquippedItem,
  SKILL_BY_ID,
  getDerivedStats,
  type GameAction,
  type PublicPlayerState,
  type SkillId,
} from '@azeroth/game';
import { ItemSymbol, Meter, Money, rarityNames } from './Common';
import { CharacterSprite } from './CharacterSprite';
import { SkillButton, SkillDetails } from './SkillControls';
import { EquipmentSlots } from './InventoryGrid';
export type GameProps = {
  player: PublicPlayerState;
  pending: boolean;
  act: (action: GameAction) => Promise<boolean>;
};
export { RegionPanel } from './MapPanel';
export { BattlePanel } from './BattlePanel';
export function QuestsPanel({ player, pending, act }: GameProps) {
  return (
    <section className="view-panel quest-view">
      <header className="panel-heading">
        <h2>Задания</h2>
      </header>
      <div className="quest-list">
        {QUESTS.map((quest) => {
          const progress = player.quests.find((q) => q.questId === quest.id),
            done = progress?.status === 'completed',
            ready = !!progress && progress.kills >= quest.objective.count,
            locked =
              player.level < quest.requiredLevel ||
              (!!quest.prerequisite &&
                !player.quests.some(
                  (q) => q.questId === quest.prerequisite && q.status === 'completed',
                ));
          return (
            <article className={`quest-entry ${done ? 'completed' : ''}`} key={quest.id}>
              <div className="quest-top">
                <h3>{quest.title}</h3>
                {done ? <Check size={16} /> : <span>ур. {quest.requiredLevel}</span>}
              </div>
              <details className="quest-story">
                <summary>{quest.giver}</summary>
                <p>{quest.description}</p>
              </details>
              {progress && !done && (
                <Meter
                  value={progress.kills}
                  max={quest.objective.count}
                  tone="experience"
                  label={MOB_BY_ID[quest.objective.mobId].name}
                />
              )}
              <div className="quest-bottom">
                <span>
                  {quest.rewards.xp} опыта · <Money copper={quest.rewards.copper} />
                </span>
                {done ? (
                  <span>Выполнено</span>
                ) : progress ? (
                  ready ? (
                    <button
                      className="button primary"
                      disabled={pending}
                      onClick={() => void act({ type: 'turnInQuest', questId: quest.id })}
                    >
                      Забрать награду
                    </button>
                  ) : (
                    <span className="muted">В процессе</span>
                  )
                ) : (
                  <button
                    className="button"
                    disabled={pending || locked}
                    onClick={() => void act({ type: 'acceptQuest', questId: quest.id })}
                  >
                    {locked ? 'Пока недоступно' : 'Принять'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export { Inventory } from './InventoryGrid';
export function HeroPanel({ player, pending, act }: GameProps) {
  const stats = getDerivedStats(player);
  return (
    <section className="view-panel hero-view">
      <header className="panel-heading">
        <h2>Персонаж</h2>
      </header>
      <div className="hero-sheet">
        <div className="hero-preview">
          <CharacterSprite player={player} />
        </div>
        <div className="hero-stats">
          {[
            ['Атака', stats.attack],
            ['Защита', stats.armor],
            ['Крит. шанс', `${Math.round(stats.critChance * 100)}%`],
            ['Точность', `${Math.round(stats.hitChance * 100)}%`],
            ['Победы', player.totalKills],
            ['Поражения', player.totalDeaths],
          ].map(([name, value]) => (
            <span key={name}>
              <small>{name}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
      </div>
      <div className="hero-equipment-slots">
        <EquipmentSlots player={player} pending={pending} act={act} />
      </div>
    </section>
  );
}
export function SkillsPanel({ player, pending, act }: GameProps) {
  const [detail, setDetail] = useState<SkillId | null>(null);
  const skill = detail ? SKILL_BY_ID[detail] : null;
  const selected = !!detail && player.skills.loadout.includes(detail);
  const available = getAvailableSkills(player);
  const source = detail
    ? EQUIPMENT_SLOTS.map((slot) => getEquippedItem(player, slot))
        .filter((item) => item?.grantedSkills.includes(detail))
        .map((item) => item!.name)
        .join(' · ')
    : '';
  const unavailable = !!detail && !available.includes(detail);
  const full = !selected && player.skills.loadout.length >= 2;
  return (
    <section className="view-panel skills-view">
      <header className="panel-heading">
        <h2>
          Приёмы <small>{player.skills.loadout.length}/2</small>
        </h2>
      </header>
      <div className="skill-palette">
        {available.map((id) => {
          const entry = SKILL_BY_ID[id];
          return (
            <div
              className={`skill-palette-entry ${player.skills.loadout.includes(entry.id) ? 'equipped' : ''}`}
              key={entry.id}
            >
              <SkillButton id={entry.id} onClick={() => setDetail(entry.id)} />
              {player.skills.loadout.includes(entry.id) && (
                <span className="skill-equipped" aria-label="Выбран">
                  <Check size={13} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {available.length === 0 && (
        <p className="empty-state">Наденьте снаряжение, чтобы открыть приёмы.</p>
      )}
      {detail && skill && (
        <SkillDetails id={detail} source={source} onClose={() => setDetail(null)}>
          <button
            className="button primary"
            data-testid={`skill-${detail}`}
            disabled={pending || unavailable || full}
            onClick={async () => {
              if (
                await act({
                  type: 'setSkills',
                  skills: selected
                    ? player.skills.loadout.filter((id) => id !== detail)
                    : [...player.skills.loadout, detail],
                })
              )
                setDetail(null);
            }}
          >
            {unavailable
              ? 'Нужно надеть предмет'
              : selected
                ? 'Убрать из боя'
                : full
                  ? 'Уже выбрано два приёма'
                  : 'Использовать в бою'}
          </button>
        </SkillDetails>
      )}
    </section>
  );
}
export function Journal({ player }: { player: PublicPlayerState }) {
  const [filter, setFilter] = useState<'events' | 'drops'>('events');
  return (
    <section className="view-panel events-view">
      <header className="panel-heading">
        <span>ЛЕТОПИСЬ ГЕРОЯ</span>
        <h2>События</h2>
        <div className="segmented">
          <button
            className={filter === 'events' ? 'active' : ''}
            onClick={() => setFilter('events')}
          >
            Хроника
          </button>
          <button className={filter === 'drops' ? 'active' : ''} onClick={() => setFilter('drops')}>
            Последняя добыча
          </button>
        </div>
      </header>
      {filter === 'events' ? (
        <div className="event-list">
          {[...player.log].reverse().map((log) => (
            <div className={`event-row event-${log.kind}`} key={log.id}>
              <time>
                {new Date(log.at).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              <p>{log.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="drops-list">
          {[...player.lootEvents].reverse().map((event) => {
            const item = ITEM_BY_ID[event.itemId];
            return (
              <div className={`drop-row rarity-${item.rarity}`} key={event.id}>
                <ItemSymbol item={item} />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {rarityNames[item.rarity]} ·{' '}
                    {event.salvaged
                      ? 'Обменян на монеты'
                      : event.source === 'quest'
                        ? 'Награда за задание'
                        : 'Получен в бою'}
                  </small>
                </span>
                <time>
                  {new Date(event.timestamp).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            );
          })}
          {!player.lootEvents.length && <p className="empty-state">Пока нет добычи.</p>}
        </div>
      )}
    </section>
  );
}
