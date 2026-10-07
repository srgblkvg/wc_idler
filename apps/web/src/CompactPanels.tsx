import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { ITEM_BY_ID, MOB_BY_ID, QUESTS, getDerivedStats, type QuestId } from '@azeroth/game';
import { CharacterSprite } from './CharacterSprite';
import { Meter, Money } from './Common';
import { EquipmentSlots } from './InventoryGrid';
import type { GameProps } from './GamePanels';

export function CompactHero({
  player,
  pending,
  act,
  openBag,
}: GameProps & { openBag: () => void }) {
  const [tab, setTab] = useState<'appearance' | 'equipment'>('appearance');
  const stats = getDerivedStats(player);
  return (
    <section className="compact-panel compact-hero" aria-label="Персонаж">
      <header className="compact-heading">
        <div className="compact-tabs" aria-label="Лист персонажа">
          <button aria-pressed={tab === 'appearance'} onClick={() => setTab('appearance')}>
            Облик
          </button>
          <button aria-pressed={tab === 'equipment'} onClick={() => setTab('equipment')}>
            Снаряжение
          </button>
        </div>
      </header>
      {tab === 'appearance' ? (
        <>
          <div className="compact-hero-portrait">
            <CharacterSprite player={player} />
          </div>
          <dl className="compact-stat-grid">
            {[
              ['Атака', stats.attack],
              ['Защита', stats.armor],
              ['Крит. шанс', `${Math.round(stats.critChance * 100)}%`],
              ['Точность', `${Math.round(stats.hitChance * 100)}%`],
              ['Победы', player.totalKills],
              ['Поражения', player.totalDeaths],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <>
          <div className="compact-hero-portrait">
            <CharacterSprite player={player} />
          </div>
          <div className="compact-equipment-slots">
            <EquipmentSlots player={player} pending={pending} act={act} />
          </div>
          <footer className="compact-footer">
            <button className="button primary" onClick={openBag}>
              Открыть сумку
              <ArrowRight size={16} />
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

export function CompactQuests({ player, pending, act }: GameProps) {
  const [selected, setSelected] = useState<QuestId | null>(null);
  const quest = QUESTS.find((q) => q.id === selected);
  const progress = quest && player.quests.find((q) => q.questId === quest.id);
  const done = progress?.status === 'completed';
  const ready = !!quest && !!progress && progress.kills >= quest.objective.count;
  const locked =
    !!quest &&
    (player.level < quest.requiredLevel ||
      (!!quest.prerequisite &&
        !player.quests.some((q) => q.questId === quest.prerequisite && q.status === 'completed')));
  return (
    <section className="compact-panel compact-quests">
      <header className="compact-heading">
        {quest ? (
          <button className="compact-back" onClick={() => setSelected(null)}>
            <ArrowLeft size={17} />
            Все задания
          </button>
        ) : (
          <div>
            <h2>Задания</h2>
          </div>
        )}
        {!quest && (
          <span className="compact-count">
            {player.quests.filter((q) => q.status === 'completed').length} / {QUESTS.length}
          </span>
        )}
      </header>
      {quest ? (
        <>
          <div className="compact-quest-detail">
            <span className="quest-giver">{quest.giver}</span>
            <h3>{quest.title}</h3>
            <p>{quest.description}</p>
            <div className="compact-objective">
              <small>Нужно победить</small>
              <strong>
                {MOB_BY_ID[quest.objective.mobId].name} × {quest.objective.count}
              </strong>
            </div>
            {progress && !done && (
              <Meter
                value={progress.kills}
                max={quest.objective.count}
                label="Выполнено"
                tone="experience"
              />
            )}
            <div className="compact-reward">
              <small>Награда</small>
              <span>
                {quest.rewards.xp} опыта · <Money copper={quest.rewards.copper} />
              </span>
              {quest.rewards.itemId && (
                <strong className={`rarity-${ITEM_BY_ID[quest.rewards.itemId].rarity}`}>
                  {ITEM_BY_ID[quest.rewards.itemId].name}
                </strong>
              )}
            </div>
          </div>
          <footer className="compact-footer">
            {done ? (
              <span className="compact-completed">
                <Check size={17} />
                Задание выполнено
              </span>
            ) : progress ? (
              <button
                className="button primary"
                disabled={pending || !ready}
                onClick={() => void act({ type: 'turnInQuest', questId: quest.id })}
              >
                {ready
                  ? 'Забрать награду'
                  : `Выполнено ${progress.kills} из ${quest.objective.count}`}
              </button>
            ) : (
              <button
                className="button primary"
                disabled={pending || locked}
                onClick={() => void act({ type: 'acceptQuest', questId: quest.id })}
              >
                {locked ? 'Сначала выполните прошлое задание' : 'Принять задание'}
              </button>
            )}
          </footer>
        </>
      ) : (
        <div className="compact-quest-list">
          {QUESTS.map((entry, index) => {
            const state = player.quests.find((q) => q.questId === entry.id);
            const completed = state?.status === 'completed';
            const unavailable =
              player.level < entry.requiredLevel ||
              (!!entry.prerequisite &&
                !player.quests.some(
                  (q) => q.questId === entry.prerequisite && q.status === 'completed',
                ));
            return (
              <button
                key={entry.id}
                className={`compact-quest-row ${completed ? 'completed' : ''}`}
                onClick={() => setSelected(entry.id)}
                data-testid={`quest-${entry.id}`}
              >
                <span className="quest-number">
                  {completed ? <Check size={20} /> : `0${index + 1}`}
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <small>{entry.giver}</small>
                  <b>
                    {completed
                      ? 'Выполнено'
                      : state
                        ? state.kills >= entry.objective.count
                          ? 'Награда ждёт'
                          : `${state.kills} / ${entry.objective.count} · в процессе`
                        : unavailable
                          ? 'Пока недоступно'
                          : 'Можно принять'}
                  </b>
                </span>
                <ArrowRight size={17} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
