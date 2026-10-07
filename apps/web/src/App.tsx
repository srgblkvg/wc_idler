import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Map,
  MoreHorizontal,
  ScrollText,
  Shield,
  Swords,
  WandSparkles,
  Wifi,
  WifiOff,
  X,
} from './UiIcons';
import { xpForNextLevel, QUEST_BY_ID } from '@azeroth/game';
import { CharacterSprite, DEFAULT_APPEARANCE, type Appearance } from './CharacterSprite';
import { Money } from './Common';
import {
  BattlePanel,
  HeroPanel,
  Inventory,
  Journal,
  QuestsPanel,
  RegionPanel,
  SkillsPanel,
} from './GamePanels';
import { CompactHero, CompactQuests } from './CompactPanels';
import { useGame } from './useGame';
import { useBattleEvents } from './useBattleEvents';

type Page = 'battle' | 'map' | 'quests' | 'bag' | 'hero' | 'skills' | 'events' | 'more';
const pages = [
  { id: 'battle' as Page, label: 'Бой', icon: Swords },
  { id: 'map' as Page, label: 'Карта', icon: Map },
  { id: 'quests' as Page, label: 'Задания', icon: ScrollText },
  { id: 'bag' as Page, label: 'Сумка', icon: Backpack },
  { id: 'hero' as Page, label: 'Герой', icon: Shield },
  { id: 'skills' as Page, label: 'Приёмы', icon: WandSparkles },
  { id: 'events' as Page, label: 'События', icon: BookOpen },
];
const morePages = [
  {
    id: 'hero' as Page,
    label: 'Персонаж',
    icon: Shield,
  },
  {
    id: 'skills' as Page,
    label: 'Боевые приёмы',
    icon: Swords,
  },
  {
    id: 'events' as Page,
    label: 'Летопись',
    icon: BookOpen,
  },
];
function useCompactScreen() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 750px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 750px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}
const creationSteps = ['Герой', 'Волосы', 'Лицо'];

export default function App() {
  const game = useGame();
  const player = game.player;
  const compact = useCompactScreen();
  const [page, setPage] = useState<Page>('battle');
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [creationStep, setCreationStep] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const feedback = useBattleEvents(player, page === 'battle');
  const props = player ? { player, pending: game.pending, act: game.act } : null;
  const reportKey = player?.offlineReport ? JSON.stringify(player.offlineReport) : null;
  const nextLevelXp = player ? xpForNextLevel(player.level) : 0;
  const experiencePercent =
    player && nextLevelXp > 0 ? Math.min(100, (player.xp / nextLevelXp) * 100) : 100;
  const readyQuest = player?.quests.some(
    (q) => q.status === 'active' && q.kills >= QUEST_BY_ID[q.questId].objective.count,
  );
  const creationBusy = game.loading || game.pending;
  const appearanceField = (key: keyof Appearance, label: string, options: [string, string][]) => (
    <fieldset disabled={creationBusy}>
      <legend>{label}</legend>
      <div>
        {options.map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={appearance[key] === value}
            className={`${appearance[key] === value ? 'selected' : ''} ${key === 'hair' ? `hair-option hair-${value}` : ''}`}
            onClick={() => setAppearance((current) => ({ ...current, [key]: value }))}
          >
            {key === 'hair' && <i aria-hidden="true" />}
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className={`app-shell ${!player ? 'creation-mode' : ''}`}>
      <header className="app-header">
        {player && (
          <button
            className="header-character"
            onClick={() => setPage('hero')}
            aria-label={`Персонаж ${player.name}`}
          >
            <span className="header-portrait">
              <CharacterSprite player={player} variant="avatar" />
            </span>
            <span className="header-identity">
              <strong>{player.name}</strong>
              <small>
                {player.appearance.gender === 'female' ? 'Ратница' : 'Ратник'} · ур. {player.level}
              </small>
            </span>
            <ChevronDown size={14} />
          </button>
        )}
        {player && (
          <div className="header-progress">
            <span>
              Уровень {player.level}
              <b>{nextLevelXp > 0 ? `${player.xp} / ${nextLevelXp}` : 'Высший уровень'}</b>
            </span>
            <i>
              <b style={{ width: `${experiencePercent}%` }} />
            </i>
          </div>
        )}
        {player && (
          <div className="header-money">
            <Money copper={player.copper} />
          </div>
        )}
        <span
          className={`connection ${game.connected ? 'online' : ''}`}
          title={game.connected ? 'Связь с сервером установлена' : 'Нет связи с сервером'}
        >
          {game.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
        </span>
        {player && (
          <span className="mobile-xp" title={`${player.xp} опыта`}>
            <i style={{ width: `${experiencePercent}%` }} />
          </span>
        )}
      </header>
      <main className="game-main">
        {game.error && (
          <div className="error-banner" role="alert">
            <span>{game.error}</span>
            <button disabled={game.pending} onClick={() => void game.refresh()}>
              Повторить
            </button>
          </div>
        )}
        {!player ? (
          <section className="character-creation">
            <div className="creation-forest" />
            <form
              className={`creation-step-${creationStep}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (creationStep < 2) setCreationStep(creationStep + 1);
                else if (name.trim().length >= 2) void game.create(name.trim(), appearance);
              }}
            >
              <header>
                <div>
                  <h1>Ваш персонаж</h1>
                </div>
                <span className="creation-step-count">
                  {creationStep + 1} <small>/ 3</small>
                </span>
              </header>
              <div className="creation-steps" aria-label="Создание персонажа">
                {creationSteps.map((label, index) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => setCreationStep(index)}
                    aria-current={index === creationStep ? 'step' : undefined}
                  >
                    <span>{index + 1}</span>
                    {label}
                  </button>
                ))}
              </div>
              <div className={`creation-avatar ${creationStep > 0 ? 'show-portrait' : ''}`}>
                <CharacterSprite appearance={appearance} portrait={creationStep > 0} />
              </div>
              <div className="appearance-settings" key={creationStep}>
                {creationStep === 0 ? (
                  <>
                    <label className="name-field">
                      Имя
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Введите имя"
                        minLength={2}
                        maxLength={24}
                        disabled={creationBusy}
                        autoComplete="off"
                      />
                    </label>
                    {appearanceField('gender', 'Пол', [
                      ['male', 'Мужчина'],
                      ['female', 'Женщина'],
                    ])}
                  </>
                ) : creationStep === 1 ? (
                  <>
                    {appearanceField('hairStyle', 'Причёска', [
                      ['short', 'Короткая'],
                      ['braid', 'Коса'],
                    ])}
                    {appearanceField('hair', 'Цвет волос', [
                      ['dark', 'Тёмные'],
                      ['fair', 'Светлые'],
                      ['red', 'Рыжие'],
                    ])}
                  </>
                ) : (
                  <>
                    {appearanceField('skin', 'Тон кожи', [
                      ['light', 'Светлый'],
                      ['tan', 'Смуглый'],
                    ])}
                    {appearanceField('mark', 'Примета', [
                      ['none', 'Без шрама'],
                      ['scar', 'Шрам'],
                    ])}
                  </>
                )}
              </div>
              <footer className="creation-actions">
                {creationStep > 0 && (
                  <button
                    type="button"
                    className="button creation-back"
                    onClick={() => setCreationStep(creationStep - 1)}
                    aria-label="Предыдущий шаг"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <button
                  className="button primary create-button"
                  type="submit"
                  disabled={creationBusy || (creationStep === 2 && name.trim().length < 2)}
                >
                  {game.loading
                    ? 'Загрузка…'
                    : game.pending
                      ? 'Создаём персонажа…'
                      : creationStep < 2
                        ? 'Далее'
                        : 'Создать'}
                  {creationStep < 2 && <ArrowRight size={17} />}
                </button>
              </footer>
              {creationStep === 2 && name.trim().length < 2 && (
                <button
                  className="creation-name-hint"
                  type="button"
                  onClick={() => setCreationStep(0)}
                >
                  Укажите имя на первом шаге
                </button>
              )}
            </form>
          </section>
        ) : (
          props && (
            <>
              {player.offlineReport &&
                player.offlineReport.elapsedMs >= 60000 &&
                reportKey !== dismissed && (
                  <div className="offline-banner">
                    <span>
                      Пока вас не было: {player.offlineReport.kills} побед · +
                      {player.offlineReport.xp} опыта
                    </span>
                    <button onClick={() => setDismissed(reportKey)} aria-label="Скрыть отчёт">
                      <X size={16} />
                    </button>
                  </div>
                )}
              {compact && ['hero', 'skills', 'events'].includes(page) && (
                <button className="section-back" onClick={() => setPage('more')}>
                  <ArrowLeft size={15} />
                  Меню
                </button>
              )}
              <div className={`page-viewport page-${page}`}>
                {page === 'battle' ? (
                  <div className="battle-layout">
                    <BattlePanel {...props} {...feedback} openBag={() => setPage('bag')} />
                    <div className="desktop-region">
                      <RegionPanel {...props} />
                    </div>
                  </div>
                ) : page === 'map' ? (
                  <RegionPanel {...props} onTravel={() => setPage('battle')} />
                ) : page === 'quests' ? (
                  compact ? (
                    <CompactQuests {...props} />
                  ) : (
                    <QuestsPanel {...props} />
                  )
                ) : page === 'bag' ? (
                  <Inventory {...props} />
                ) : page === 'hero' ? (
                  compact ? (
                    <CompactHero {...props} openBag={() => setPage('bag')} />
                  ) : (
                    <HeroPanel {...props} />
                  )
                ) : page === 'skills' ? (
                  <SkillsPanel {...props} />
                ) : page === 'events' ? (
                  <Journal player={player} />
                ) : (
                  <section className="more-panel">
                    <header className="compact-heading">
                      <div>
                        <h2>Меню</h2>
                      </div>
                    </header>
                    <div className="more-links">
                      {morePages.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setPage(id)}>
                          <Icon size={32} />
                          <span>
                            <strong>{label}</strong>
                          </span>
                          <ChevronRight size={19} />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          )
        )}
      </main>
      {player && (
        <nav className="main-navigation" aria-label="Разделы игры">
          {(compact ? pages.slice(0, 4) : pages).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={page === id ? 'page' : undefined}
              className={page === id ? 'active' : ''}
              onClick={() => setPage(id)}
            >
              <Icon size={30} />
              <span>{label}</span>
              {id === 'quests' && readyQuest && <i />}
            </button>
          ))}
          {compact && (
            <button
              aria-current={
                ['more', 'hero', 'skills', 'events'].includes(page) ? 'page' : undefined
              }
              className={['more', 'hero', 'skills', 'events'].includes(page) ? 'active' : ''}
              onClick={() => setPage('more')}
            >
              <MoreHorizontal size={30} />
              <span>Ещё</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
