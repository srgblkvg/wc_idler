import {
  BookOpen,
  Check,
  ChevronRight,
  CirclePause,
  Heart,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Trees,
  Trophy,
} from 'lucide-react';
import {
  ITEM_BY_ID,
  MOBS,
  MOB_BY_ID,
  QUESTS,
  getDerivedStats,
  xpForNextLevel,
  type GameAction,
  type PublicPlayerState,
} from '@azeroth/game';
import { Cross, ItemSymbol, Meter, Money, PanelTitle, slotNames, StatText } from './Common';

type Props = {
  player: PublicPlayerState;
  pending: boolean;
  act: (action: GameAction) => Promise<boolean>;
};
export function RegionPanel({ player, pending, act }: Props) {
  return (
    <section className="panel region-panel">
      <PanelTitle icon={Trees} aside={<span className="tiny-label">01 — 05</span>}>
        Окрестности
      </PanelTitle>
      <p className="panel-description">У каждой тропы — своя история.</p>
      <div className="mob-list">
        {MOBS.map((mob, i) => {
          const selected = player.targetMobId === mob.id;
          return (
            <button
              className={`mob-card ${selected ? 'selected' : ''}`}
              key={mob.id}
              onClick={() => void act({ type: 'startHunt', mobId: mob.id })}
              disabled={pending || player.level < mob.level}
              aria-pressed={selected}
            >
              <div className={`mob-seal mob-${mob.id}`}>
                {i < 2 ? (
                  <img
                    src="/art/characters.png"
                    className={i === 0 ? 'wolf-portrait' : 'kobold-portrait'}
                    alt=""
                  />
                ) : (
                  <Skull size={26} />
                )}
              </div>
              <div className="mob-copy">
                <div className="mob-line">
                  <strong>{mob.name}</strong>
                  <span>ур. {mob.level}</span>
                </div>
                <p>{player.level < mob.level ? `Доступно с ${mob.level} уровня` : mob.location}</p>
                <div className="mob-rewards">
                  <span>
                    <Sparkles size={11} />
                    {mob.xp} опыта
                  </span>
                  <span>
                    <span className="copper-dot" />
                    {mob.copper} меди
                  </span>
                </div>
              </div>
              <ChevronRight className="mob-arrow" size={15} />
              {selected && <span className="chosen-label">ЦЕЛЬ ОХОТЫ</span>}
            </button>
          );
        })}
      </div>
      <div className="region-note">
        <Cross small />
        <p>Свет хранит тех, кто оберегает эти земли.</p>
      </div>
      <div className="region-footer">
        <span>ЗЕМЛИ АЛЬЯНСА</span>
        <span className="alliance-seal">♜</span>
      </div>
    </section>
  );
}
export function BattlePanel({ player, pending, act }: Props) {
  const stats = getDerivedStats(player);
  const mob = player.encounter
    ? MOB_BY_ID[player.encounter.mobId]
    : player.targetMobId
      ? MOB_BY_ID[player.targetMobId]
      : null;
  const active = player.mode === 'hunting';
  const resting = player.mode === 'resting';
  return (
    <section className="panel battle-panel">
      <PanelTitle
        icon={Swords}
        aside={
          <span className={`status-badge ${active ? 'live' : ''}`}>
            <i />
            {active ? 'В БОЮ' : resting ? 'ОТДЫХ' : 'НА ПРИВАЛЕ'}
          </span>
        }
      >
        Приключение
      </PanelTitle>
      <div className={`battle-art ${active ? 'is-active' : ''}`}>
        <div className="battle-fighter hero-fighter">
          <img src="/art/characters.png" alt="Паладин Альянса" />
        </div>
        <div className={`battle-fighter enemy-fighter enemy-${mob?.id || 'wolf'}`}>
          {mob?.id === 'defias' ? (
            <div className="defias-emblem">
              <Skull size={55} strokeWidth={1} />
              <Swords size={76} strokeWidth={0.8} />
            </div>
          ) : (
            <img src="/art/characters.png" alt={mob?.name || 'Лесной волк'} />
          )}
        </div>
        <span className="battle-location">ЭЛВИННСКИЙ ЛЕС</span>
        <div className="battle-vs">
          <span>{player.name}</span>
          <b>✦</b>
          <span>{mob?.name || 'Тихая тропа'}</span>
        </div>
      </div>
      <div className="battle-body">
        <div className="battle-headline">
          <span className="eyebrow">
            {resting ? 'ВОССТАНОВЛЕНИЕ СИЛ' : active ? 'ОХОТА ПРОДОЛЖАЕТСЯ' : 'ВАШЕ ПРИКЛЮЧЕНИЕ'}
          </span>
          <h3>{resting ? 'Под защитой Света' : active ? mob?.name : 'В путь, защитник'}</h3>
          <p>
            {resting
              ? 'Здоровье и мана восстанавливаются автоматически.'
              : active
                ? `Раунд ${player.encounter?.round ?? 0} · ${mob?.location ?? 'Североземье'}`
                : 'Выберите противника на окрестных тропах.'}
          </p>
        </div>
        {player.encounter && (
          <Meter
            value={player.encounter.hp}
            max={player.encounter.maxHp}
            tone="red"
            label={mob?.name || 'Противник'}
          />
        )}
        <div className="player-meters">
          <Meter value={player.hp} max={stats.maxHp} label="Здоровье" />
          <Meter value={player.mana} max={stats.maxMana} tone="blue" label="Мана" />
        </div>
        <div className="battle-controls">
          {active ? (
            <button
              className="button primary"
              disabled={pending}
              onClick={() => void act({ type: 'stopHunt' })}
            >
              <CirclePause size={16} />
              Остановить охоту
            </button>
          ) : (
            <button
              className="button primary"
              disabled={pending || resting}
              onClick={() => void act({ type: 'startHunt', mobId: player.targetMobId || 'wolf' })}
            >
              <Swords size={16} />
              {resting ? 'Восстановление…' : 'Отправиться на охоту'}
            </button>
          )}
          <button
            className="button quiet"
            disabled={pending || resting}
            onClick={() => void act({ type: 'rest' })}
            title="Отдохнуть и восстановить здоровье и ману"
          >
            <Heart size={15} />
            Отдых
          </button>
        </div>
        <p className="idle-note">
          <span className="small-dot" />
          Бой и добыча продолжаются, пока вы отсутствуете.
        </p>
      </div>
    </section>
  );
}
export function QuestsPanel({ player, pending, act, full = false }: Props & { full?: boolean }) {
  const completeCount = player.quests.filter((q) => q.status === 'completed').length;
  return (
    <section className={`panel quests-panel ${full ? 'full-quests' : ''}`}>
      <PanelTitle
        icon={ScrollText}
        aside={
          <span className="tiny-label">
            {completeCount} / {QUESTS.length}
          </span>
        }
      >
        Журнал заданий
      </PanelTitle>
      <p className="panel-description">Североземье нуждается в вас.</p>
      <div className="quest-list">
        {QUESTS.map((quest) => {
          const progress = player.quests.find((q) => q.questId === quest.id);
          const done = progress?.status === 'completed';
          const ready = !!progress && progress.kills >= quest.objective.count;
          const locked =
            player.level < quest.requiredLevel ||
            (!!quest.prerequisite &&
              !player.quests.some(
                (q) => q.questId === quest.prerequisite && q.status === 'completed',
              ));
          return (
            <div key={quest.id} className={`quest-card ${done ? 'finished' : ''}`}>
              <div className="quest-title">
                <span className={`quest-sign ${done ? 'complete' : ready ? 'ready' : ''}`}>
                  {done ? <Check size={16} /> : progress ? '?' : '!'}
                </span>
                <h3>{quest.title}</h3>
              </div>
              <p>{full ? quest.description : quest.giver}</p>
              {progress && !done && (
                <div className="quest-progress">
                  <div>
                    <span>{MOB_BY_ID[quest.objective.mobId].name}</span>
                    <b>
                      {Math.min(progress.kills, quest.objective.count)} / {quest.objective.count}
                    </b>
                  </div>
                  <span className="quest-track">
                    <i
                      style={{
                        width: `${Math.min(100, (progress.kills / quest.objective.count) * 100)}%`,
                      }}
                    />
                  </span>
                </div>
              )}
              <div className="quest-rewards">
                <span>
                  <Sparkles size={12} />
                  {quest.rewards.xp} опыта
                </span>
                <Money copper={quest.rewards.copper} />
              </div>
              {done ? (
                <span className="quest-completed">
                  <Check size={13} />
                  Задание выполнено
                </span>
              ) : progress ? (
                ready ? (
                  <button
                    className="button quest-button"
                    disabled={pending}
                    onClick={() => void act({ type: 'turnInQuest', questId: quest.id })}
                  >
                    Получить награду
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <span className="quest-active">
                    <span className="small-dot" />В процессе
                  </span>
                )
              ) : (
                <button
                  className="button quest-button"
                  disabled={pending || locked}
                  onClick={() => void act({ type: 'acceptQuest', questId: quest.id })}
                >
                  {locked
                    ? `Требуется ${player.level < quest.requiredLevel ? `${quest.requiredLevel} уровень` : 'предыдущее задание'}`
                    : 'Принять задание'}
                  {!locked && <ChevronRight size={14} />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function Journal({
  player,
  expanded = false,
}: {
  player: PublicPlayerState;
  expanded?: boolean;
}) {
  const logs = [...player.log].reverse().slice(0, expanded ? 50 : 5);
  return (
    <section className={`panel journal ${expanded ? 'expanded' : ''}`}>
      <PanelTitle
        icon={BookOpen}
        aside={
          <span className="journal-live">
            <i />
            ОБНОВЛЯЕТСЯ
          </span>
        }
      >
        Хроника приключений
      </PanelTitle>
      <div className="log-list">
        {logs.length ? (
          logs.map((log) => (
            <div className={`log-row log-${log.kind}`} key={log.id}>
              <time>
                {new Date(log.at).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              <span className="log-icon">
                {log.kind === 'loot' ? (
                  <Trophy size={13} />
                ) : log.kind === 'quest' ? (
                  <ScrollText size={13} />
                ) : log.kind === 'level' ? (
                  <Sparkles size={13} />
                ) : (
                  <Sword size={13} />
                )}
              </span>
              <span>{log.message}</span>
            </div>
          ))
        ) : (
          <div className="empty-log">
            Ваша история начинается здесь. Отправляйтесь на первую охоту.
          </div>
        )}
      </div>
    </section>
  );
}
export function Inventory({
  player,
  pending,
  act,
  character = false,
}: Props & { character?: boolean }) {
  const stats = getDerivedStats(player);
  return (
    <div className="inventory-view">
      {character && (
        <section className="panel character-sheet">
          <div className="character-portrait">
            <img src="/art/characters.png" alt="Паладин" />
            <span className="portrait-level">{player.level}</span>
          </div>
          <span className="eyebrow">ЧЕЛОВЕК · ПАЛАДИН</span>
          <h2>{player.name}</h2>
          <p>Защитник Североземья</p>
          <Meter value={player.xp} max={xpForNextLevel(player.level)} tone="gold" label="Опыт" />
          <div className="stat-grid">
            {[
              [Sword, 'Атака', stats.attack],
              [Shield, 'Защита', stats.armor],
              [Heart, 'Здоровье', stats.maxHp],
              [Sparkles, 'Мана', stats.maxMana],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Sword;
              return (
                <div key={String(label)}>
                  <I size={19} />
                  <b>{String(value)}</b>
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="panel gear-panel">
        <PanelTitle
          icon={character ? Shield : Trophy}
          aside={<span className="tiny-label">{player.inventory.length} ПРЕДМЕТОВ</span>}
        >
          {character ? 'Снаряжение' : 'Походная сумка'}
        </PanelTitle>
        <p className="panel-description">
          {character
            ? 'Свет — ваш щит. Хорошая сталь тоже пригодится.'
            : 'Трофеи, снаряжение и маленькие победы.'}
        </p>
        {character && (
          <div className="equipment-slots">
            {(['weapon', 'armor', 'trinket'] as const).map((slot) => {
              const equipped = player.inventory.find(
                (i) => i.instanceId === player.equipment[slot],
              );
              const item = equipped ? ITEM_BY_ID[equipped.itemId] : null;
              return (
                <div className="equipment-slot" key={slot}>
                  {item ? (
                    <ItemSymbol item={item} />
                  ) : (
                    <span className="empty-slot">
                      <Shield size={23} />
                    </span>
                  )}
                  <div>
                    <span className="eyebrow">{slotNames[slot]}</span>
                    <strong>{item?.name || 'Не экипировано'}</strong>
                    {item && (
                      <small>
                        <StatText item={item} />
                      </small>
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
        )}
        <div className="inventory-grid">
          {player.inventory.map((instance) => {
            const item = ITEM_BY_ID[instance.itemId];
            const equipped = player.equipment[item.slot] === instance.instanceId;
            return (
              <article className={`inventory-item ${item.rarity}`} key={instance.instanceId}>
                <ItemSymbol item={item} />
                <div>
                  <span className="eyebrow">
                    {slotNames[item.slot]} · ур. {item.requiredLevel}
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small>
                    <StatText item={item} />
                  </small>
                </div>
                <button
                  className={`button ${equipped ? 'equipped-button' : 'quest-button'}`}
                  disabled={pending || item.requiredLevel > player.level}
                  onClick={() =>
                    void act(
                      equipped
                        ? { type: 'unequip', slot: item.slot }
                        : { type: 'equip', itemInstanceId: instance.instanceId },
                    )
                  }
                >
                  {equipped ? (
                    <>
                      <Check size={13} />
                      Надето · снять
                    </>
                  ) : item.requiredLevel > player.level ? (
                    'Уровень слишком низкий'
                  ) : (
                    'Надеть'
                  )}
                </button>
              </article>
            );
          })}
        </div>
        {!player.inventory.length && (
          <p className="empty-log">В сумке пока пусто. С противников выпадает снаряжение.</p>
        )}
      </section>
    </div>
  );
}
