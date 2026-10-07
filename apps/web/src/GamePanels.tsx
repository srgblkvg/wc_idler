import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CirclePause,
  Flame,
  Heart,
  MapPin,
  ScrollText,
  Shield,
  Sword,
  Trees,
  X,
} from 'lucide-react';
import {
  ITEM_BY_ID,
  MOBS,
  MOB_BY_ID,
  QUESTS,
  SKILLS,
  SKILL_BY_ID,
  getDerivedStats,
  type CombatEvent,
  type GameAction,
  type LootEvent,
  type PublicPlayerState,
  type SkillId,
} from '@azeroth/game';
import { ItemSymbol, Meter, Money, RarityLegend, rarityNames, slotNames, StatText } from './Common';
import { CharacterSprite, EnemySprite, equippedItem } from './CharacterSprite';
export type GameProps = {
  player: PublicPlayerState;
  pending: boolean;
  act: (action: GameAction) => Promise<boolean>;
};
export function RegionPanel({
  player,
  pending,
  act,
  onTravel,
}: GameProps & { onTravel?: () => void }) {
  return (
    <section className="region-panel view-panel">
      <header className="panel-heading">
        <span>БЕРЁЗОВЫЙ БРОД</span>
        <h2>Окрестности</h2>
      </header>
      <div className="region-map" aria-hidden="true">
        <svg viewBox="0 0 300 160">
          <path
            d="M25 142Q100 106 78 69T175 20M78 69Q139 90 239 123"
            fill="none"
            stroke="#a1834b"
            strokeWidth="2"
            strokeDasharray="4 6"
          />
          <path
            d="M47 35L54 20 64 41M160 110L173 83 188 117M235 36L249 11 260 47M21 108L33 82 45 113M110 41L119 19 130 50"
            fill="none"
            stroke="#52684b"
            strokeWidth="3"
          />
          <circle cx="78" cy="69" r="6" fill="#bc9562" />
          <circle cx="175" cy="20" r="5" fill="#7e976c" />
          <circle cx="239" cy="123" r="5" fill="#798f73" />
          <text x="94" y="67">
            Брод
          </text>
          <text x="191" y="25">
            Бор
          </text>
          <text x="197" y="146">
            Болото
          </text>
        </svg>
      </div>
      <div className="region-list">
        {MOBS.map((mob) => (
          <button
            key={mob.id}
            data-testid={`travel-${mob.id}`}
            className={`region-node ${player.targetMobId === mob.id ? 'selected' : ''}`}
            disabled={pending || player.level < mob.level}
            onClick={async () => {
              if (await act({ type: 'startHunt', mobId: mob.id })) onTravel?.();
            }}
          >
            <span className="region-node-art">
              <EnemySprite mobId={mob.id} />
            </span>
            <span className="region-node-copy">
              <strong>{mob.location}</strong>
              <span>
                {mob.name} · ур. {mob.level}
              </span>
              <small>
                {player.level < mob.level
                  ? `Нужен ${mob.level} уровень`
                  : `${mob.xp} опыта · ${mob.copper} меди`}
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      <button
        className="camp-button"
        disabled={pending || player.mode === 'resting'}
        onClick={() => void act({ type: 'rest' })}
      >
        <Flame size={17} />
        <span>
          Вернуться к костру<small>Восстановить здоровье и силу</small>
        </span>
      </button>
    </section>
  );
}
function ForestBackdrop() {
  return (
    <svg
      className="forest-drawing"
      viewBox="0 0 900 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="forest-mist" x2="0" y2="1">
          <stop stopColor="#25382d" />
          <stop offset="1" stopColor="#4c5140" />
        </linearGradient>
      </defs>
      <rect width="900" height="500" fill="url(#forest-mist)" />
      {[50, 130, 250, 370, 520, 630, 740, 860].map((x, i) => (
        <g key={x} opacity={i % 2 ? 0.5 : 0.25}>
          <path d={`M${x} 0L${x + 15} 390 ${x - 12} 410 ${x - 10} 0`} fill="#161f18" />
          <path
            d={`M${x} 90L${x - 75} 20M${x + 2} 180L${x + 100} 100M${x} 265L${x - 70} 186`}
            stroke="#182b1b"
            strokeWidth="9"
          />
          <path d={`M${x + 10} 0L${x + 20} 405`} stroke="#849078" strokeWidth="4" />
        </g>
      ))}
      <path d="M0 402Q90 365 188 398T419 406Q595 364 727 394T900 408V500H0Z" fill="#29372a" />
      <path d="M0 457Q100 421 250 436T520 420Q715 444 900 423V500H0Z" fill="#182b20" />
      {[38, 205, 326, 570, 701, 851].map((x) => (
        <path
          key={x}
          d={`M${x} 462L${x - 20} 425M${x} 462L${x + 13} 420M${x} 448L${x + 27} 436M${x - 3} 446L${x - 31} 439`}
          stroke="#64704b"
          strokeWidth="3"
          fill="none"
        />
      ))}
    </svg>
  );
}
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
  const stats = getDerivedStats(player);
  const mob = player.encounter
    ? MOB_BY_ID[player.encounter.mobId]
    : player.targetMobId
      ? MOB_BY_ID[player.targetMobId]
      : null;
  const playerHit = combat?.target === 'player' && combat.kind === 'attack',
    enemyHit = combat?.target === 'enemy' && combat.kind === 'attack';
  const drop = loot ? ITEM_BY_ID[loot.itemId] : null;
  const amount = combat?.missed
    ? 'Мимо'
    : combat?.healing
      ? `+${combat.healing}`
      : combat?.kind === 'ward'
        ? 'Оберег'
        : combat?.damage
          ? `−${combat.damage}`
          : combat?.kind === 'victory'
            ? 'Победа'
            : combat?.kind === 'defeat'
              ? 'Поражение'
              : '';
  return (
    <section className="battle-panel">
      <div className="battle-heading">
        <span>
          <MapPin size={13} />
          {mob?.location || 'Берёзовый Брод'}
        </span>
        <span className={`mode-indicator ${player.mode}`}>
          {player.mode === 'hunting'
            ? 'Автобой'
            : player.mode === 'resting'
              ? 'У костра'
              : 'Привал'}
          <i />
        </span>
      </div>
      <div
        data-testid="battle-scene"
        className={`battle-arena region-${mob?.id || 'camp'}`}
        key={player.targetMobId || 'camp'}
      >
        <ForestBackdrop />
        <div className="arena-mist" />
        <div
          className={`fighter hero-fighter ${combat?.source === 'player' && combat.kind === 'attack' ? 'attacking' : ''} ${playerHit ? 'hit' : ''} ${combat?.kind === 'heal' ? 'healing' : ''}`}
          key={`hero-${combat?.id || 0}`}
        >
          <CharacterSprite player={player} />
          {combat?.target === 'player' && amount && (
            <div
              className={`floating-damage ${combat.healing ? 'heal' : ''} ${combat.critical ? 'critical' : ''}`}
            >
              {amount}
              {combat.critical && <small>Критический удар</small>}
            </div>
          )}
          <span className="fighter-name">{player.name}</span>
        </div>
        <div
          className={`fighter foe-fighter ${combat?.source === 'enemy' && combat.kind === 'attack' ? 'attacking' : ''} ${enemyHit ? 'hit' : ''}`}
          key={`foe-${combat?.id || 0}`}
        >
          {mob ? (
            <EnemySprite mobId={mob.id} />
          ) : (
            <svg className="campfire-art" viewBox="0 0 150 200" aria-label="Костёр">
              <ellipse cx="75" cy="170" rx="53" ry="11" fill="#111b13" />
              <path
                d="M38 158L110 176M36 176L110 157"
                stroke="#5b3e29"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M51 155Q21 120 56 86L58 117Q84 89 79 55Q130 119 103 153Q81 178 51 155Z"
                fill="#b77b34"
              />
              <path d="M65 154Q46 135 69 110L75 127 90 113Q109 155 80 162Z" fill="#dbb36a" />
            </svg>
          )}
          {combat?.target === 'enemy' && amount && (
            <div className={`floating-damage ${combat.critical ? 'critical' : ''}`}>
              {amount}
              {combat.critical && <small>Критический удар</small>}
            </div>
          )}
          <span className="fighter-name">{mob?.name || 'Костёр'}</span>
        </div>
        {!mob && <div className="camp-label">Выберите тропу на карте</div>}
        {combat?.ability && combat.ability !== 'basicAttack' && (
          <span className="ability-flash" key={combat.id}>
            {SKILL_BY_ID[combat.ability]?.name}
          </span>
        )}
        {loot && drop && (
          <div
            data-testid="loot-notice"
            className={`loot-notice rarity-${drop.rarity}`}
            role="status"
          >
            <ItemSymbol item={drop} />
            <div className="loot-notice-copy">
              <small>
                {rarityNames[drop.rarity]} · {loot.source === 'quest' ? 'награда' : 'добыча'}
              </small>
              <strong>{drop.name}</strong>
              <div className="loot-actions">
                {loot.instanceId && (
                  <button
                    disabled={
                      pending ||
                      drop.requiredLevel > player.level ||
                      player.equipment[drop.slot] === loot.instanceId
                    }
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
          <Meter value={player.hp} max={stats.maxHp} label="Здоровье" />
          <div className="opponent-meter">
            {mob ? (
              <Meter
                value={player.encounter?.hp ?? mob.hp}
                max={player.encounter?.maxHp || mob.hp}
                tone="enemy"
                label={mob.name}
              />
            ) : (
              <span className="camp-status">
                {player.mode === 'resting' ? 'Восстановление сил' : 'Тихий привал'}
              </span>
            )}
          </div>
        </div>
        <div className="battle-power-row">
          <Meter value={player.mana} max={stats.maxMana} tone="power" label="Сила" />
          <span className="round-label">
            {player.mode === 'hunting'
              ? `Раунд ${player.encounter?.round || 0}`
              : player.mode === 'resting'
                ? 'Восстановление сил'
                : 'Готов к пути'}
          </span>
        </div>
        <div className="skill-hud">
          {player.skills.loadout.map((id) => (
            <span
              key={id}
              className={`skill-pill ${combat?.ability === id ? 'used' : ''}`}
              title={SKILL_BY_ID[id].description}
            >
              <span>
                {id === 'heavyStrike' ? (
                  <Sword size={14} />
                ) : id === 'ward' ? (
                  <Shield size={14} />
                ) : (
                  <Heart size={14} />
                )}
              </span>
              <b>{SKILL_BY_ID[id].name}</b>
              <small>
                {player.skills.cooldowns[id] > 0 ? `${player.skills.cooldowns[id]} ход.` : 'готов'}
              </small>
            </span>
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
              Остановить бой
            </button>
          ) : (
            <button
              className="button primary"
              disabled={pending || player.mode === 'resting'}
              onClick={() => void act({ type: 'startHunt', mobId: player.targetMobId || 'wolf' })}
            >
              <Sword size={16} />
              {player.mode === 'resting' ? 'Восстановление…' : 'Начать бой'}
            </button>
          )}
          <button
            className="button"
            disabled={pending || player.mode === 'resting'}
            onClick={() => void act({ type: 'rest' })}
          >
            <Flame size={16} />
            Отдых
          </button>
        </div>
        <p className="battle-note">
          {player.mode === 'hunting'
            ? 'Бой продолжается, когда вы не в игре.'
            : 'Навыки срабатывают автоматически.'}
        </p>
      </div>
    </section>
  );
}
export function QuestsPanel({ player, pending, act }: GameProps) {
  return (
    <section className="view-panel quest-view">
      <header className="panel-heading">
        <span>ПОРУЧЕНИЯ ЖИТЕЛЕЙ</span>
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
              <span className="quest-giver">{quest.giver}</span>
              <p>{quest.description}</p>
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
export function Inventory({ player, pending, act }: GameProps) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section className="view-panel bag-view">
      <header className="panel-heading">
        <span>СНАРЯЖЕНИЕ И ТРОФЕИ</span>
        <h2>
          Сумка <small>{player.inventory.length}/100</small>
        </h2>
        <RarityLegend />
      </header>
      <div className="item-list">
        {[...player.inventory].reverse().map((instance) => {
          const item = ITEM_BY_ID[instance.itemId],
            equipped = player.equipment[item.slot] === instance.instanceId,
            open = selected === instance.instanceId;
          return (
            <article
              data-testid={`bag-item-${instance.itemId}`}
              className={`item-entry rarity-${item.rarity} ${open ? 'open' : ''}`}
              key={instance.instanceId}
            >
              <button
                className="item-heading"
                onClick={() => setSelected(open ? null : instance.instanceId)}
                aria-expanded={open}
              >
                <ItemSymbol item={item} />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {rarityNames[item.rarity]} · {slotNames[item.slot]} · ур. {item.requiredLevel}
                  </small>
                </span>
                {equipped ? <Check size={16} /> : <ArrowRight size={15} />}
              </button>
              {open && (
                <div className="item-detail">
                  <p>{item.description}</p>
                  <strong>
                    <StatText item={item} />
                  </strong>
                  <button
                    className="button"
                    disabled={pending || player.level < item.requiredLevel}
                    onClick={() =>
                      void act(
                        equipped
                          ? { type: 'unequip', slot: item.slot }
                          : { type: 'equip', itemInstanceId: instance.instanceId },
                      )
                    }
                  >
                    {equipped
                      ? 'Снять'
                      : player.level < item.requiredLevel
                        ? `Нужен ${item.requiredLevel} уровень`
                        : 'Надеть'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {!player.inventory.length && (
          <p className="empty-state">Сумка пуста. Добыча появится после боя.</p>
        )}
      </div>
    </section>
  );
}
export function HeroPanel({ player, pending, act }: GameProps) {
  const stats = getDerivedStats(player);
  return (
    <section className="view-panel hero-view">
      <header className="panel-heading">
        <span>ЧЕЛОВЕК · {player.appearance.gender === 'female' ? 'РАТНИЦА' : 'РАТНИК'}</span>
        <h2>
          {player.name} <small>ур. {player.level}</small>
        </h2>
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
      <div className="equipped-list">
        {(['weapon', 'armor', 'trinket'] as const).map((slot) => {
          const item = equippedItem(player, slot);
          return (
            <div
              data-testid={`equipment-${slot}`}
              className={`equipment-row rarity-${item?.rarity || 'common'}`}
              key={slot}
            >
              {item ? (
                <ItemSymbol item={item} />
              ) : (
                <span className="empty-equipment">
                  <Shield size={21} />
                </span>
              )}
              <div>
                <small>
                  {slotNames[slot]}
                  {item && ` · ${rarityNames[item.rarity]}`}
                </small>
                <strong>{item?.name || 'Не надето'}</strong>
                {item && (
                  <span>
                    <StatText item={item} />
                  </span>
                )}
              </div>
              {item && (
                <button
                  className="text-button"
                  disabled={pending}
                  onClick={() => void act({ type: 'unequip', slot })}
                >
                  Снять
                </button>
              )}
            </div>
          );
        })}
      </div>
      <RarityLegend />
    </section>
  );
}
export function SkillsPanel({ player, pending, act }: GameProps) {
  const toggle = (id: SkillId) => {
    const chosen = player.skills.loadout;
    void act({
      type: 'setSkills',
      skills: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id],
    });
  };
  return (
    <section className="view-panel skills-view">
      <header className="panel-heading">
        <span>АВТОМАТИЧЕСКИЕ ПРИЁМЫ</span>
        <h2>
          Навыки <small>{player.skills.loadout.length}/2</small>
        </h2>
        <p>Выберите два приёма. Они сами применяются в бою.</p>
      </header>
      <div className="skills-list">
        {SKILLS.map((skill) => {
          const selected = player.skills.loadout.includes(skill.id),
            locked = player.level < skill.requiredLevel;
          return (
            <article className={`skill-entry ${selected ? 'selected' : ''}`} key={skill.id}>
              <div className="skill-title">
                <span className="skill-glyph">
                  {skill.id === 'heavyStrike' ? (
                    <Sword />
                  ) : skill.id === 'ward' ? (
                    <Shield />
                  ) : (
                    <Heart />
                  )}
                </span>
                <div>
                  <h3>{skill.name}</h3>
                  <small>
                    {skill.manaCost} силы · {skill.cooldownTurns} ход. откат
                  </small>
                </div>
                <button
                  data-testid={`skill-${skill.id}`}
                  className={`skill-toggle ${selected ? 'selected' : ''}`}
                  aria-label={`${selected ? 'Убрать' : 'Выбрать'} навык ${skill.name}`}
                  aria-pressed={selected}
                  disabled={pending || locked || (!selected && player.skills.loadout.length >= 2)}
                  onClick={() => toggle(skill.id)}
                >
                  {selected ? <Check size={15} /> : '+'}
                </button>
              </div>
              <p>{skill.description}</p>
              <span className="skill-policy">
                {locked
                  ? `Откроется на ${skill.requiredLevel} уровне`
                  : skill.policy === 'healthBelow'
                    ? `При здоровье ниже ${Math.round((skill.healthBelow || 0) * 100)}%`
                    : 'Применяется при готовности'}
              </span>
            </article>
          );
        })}
      </div>
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
