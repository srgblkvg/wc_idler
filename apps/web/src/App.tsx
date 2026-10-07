import { useState } from 'react';
import {
  Backpack,
  BookOpen,
  ChevronDown,
  Map,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { xpForNextLevel, QUEST_BY_ID } from '@azeroth/game';
import { CharacterSprite, DEFAULT_APPEARANCE, type Appearance } from './CharacterSprite';
import { Knot, Money } from './Common';
import {
  BattlePanel,
  HeroPanel,
  Inventory,
  Journal,
  QuestsPanel,
  RegionPanel,
  SkillsPanel,
} from './GamePanels';
import { useGame } from './useGame';
import { useBattleEvents } from './useBattleEvents';
type Page = 'battle' | 'map' | 'quests' | 'bag' | 'hero' | 'skills' | 'events';
const pages = [
  { id: 'battle' as Page, label: 'Бой', icon: Swords },
  { id: 'map' as Page, label: 'Карта', icon: Map },
  { id: 'quests' as Page, label: 'Задания', icon: ScrollText },
  { id: 'bag' as Page, label: 'Сумка', icon: Backpack },
  { id: 'hero' as Page, label: 'Герой', icon: Shield },
  { id: 'skills' as Page, label: 'Навыки', icon: Sparkles },
  { id: 'events' as Page, label: 'События', icon: BookOpen },
];
const settings: [keyof Appearance, string, [string, string][]][] = [
  [
    'gender',
    'Пол',
    [
      ['male', 'Мужчина'],
      ['female', 'Женщина'],
    ],
  ],
  [
    'hair',
    'Волосы',
    [
      ['dark', 'Тёмные'],
      ['fair', 'Светлые'],
      ['red', 'Рыжие'],
    ],
  ],
  [
    'hairStyle',
    'Причёска',
    [
      ['short', 'Короткая'],
      ['braid', 'Коса'],
    ],
  ],
  [
    'skin',
    'Кожа',
    [
      ['light', 'Светлая'],
      ['tan', 'Смуглая'],
    ],
  ],
  [
    'mark',
    'Примета',
    [
      ['none', 'Нет'],
      ['scar', 'Шрам'],
    ],
  ],
];
export default function App() {
  const game = useGame();
  const player = game.player;
  const [page, setPage] = useState<Page>('battle');
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const feedback = useBattleEvents(player);
  const props = player ? { player, pending: game.pending, act: game.act } : null;
  const reportKey = player?.offlineReport ? JSON.stringify(player.offlineReport) : null;
  return (
    <div className={`app-shell ${!player ? 'creation-mode' : ''}`}>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('battle');
          }}
        >
          <Knot />
          <span>
            ИРИЙ<small>БЕРЁЗОВЫЙ БРОД</small>
          </span>
        </a>
        {player && (
          <button className="header-character" onClick={() => setPage('hero')}>
            <span className="header-portrait">
              <CharacterSprite player={player} />
            </span>
            <span className="header-identity">
              <strong>{player.name}</strong>
              <small>
                Человек · {player.appearance.gender === 'female' ? 'Ратница' : 'Ратник'} · ур.{' '}
                {player.level}
              </small>
            </span>
            <ChevronDown size={14} />
          </button>
        )}
        {player && (
          <div className="header-progress">
            <span>
              Уровень {player.level}
              <b>
                {player.xp} / {xpForNextLevel(player.level)}
              </b>
            </span>
            <i>
              <b style={{ width: `${(player.xp / xpForNextLevel(player.level)) * 100}%` }} />
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
          <span>{game.connected ? 'На связи' : 'Не в сети'}</span>
        </span>
      </header>
      {player && (
        <div className="location-bar">
          <span>
            Берёзовый Брод <b>/</b> {pages.find((p) => p.id === page)?.label}
          </span>
          <span className="save-state">
            <i />
            {game.pending ? 'Сохраняем…' : game.connected ? 'Сохранено' : 'Ожидание связи'}
          </span>
        </div>
      )}
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
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length >= 2) void game.create(name.trim(), appearance);
              }}
            >
              <header>
                <Knot />
                <div>
                  <span>ЧЕЛОВЕК · {appearance.gender === 'female' ? 'РАТНИЦА' : 'РАТНИК'}</span>
                  <h1>Создать персонажа</h1>
                </div>
              </header>
              <label className="name-field">
                Имя
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Введите имя"
                  required
                  minLength={2}
                  maxLength={24}
                  disabled={game.loading || game.pending}
                  autoComplete="off"
                />
              </label>
              <div className="creation-body">
                <div className="creation-avatar">
                  <CharacterSprite appearance={appearance} />
                </div>
                <div className="appearance-settings">
                  {settings.map(([key, label, options]) => (
                    <fieldset key={key} disabled={game.pending || game.loading}>
                      <legend>{label}</legend>
                      <div>
                        {options.map(([value, text]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={appearance[key] === value}
                            className={appearance[key] === value ? 'selected' : ''}
                            onClick={() => setAppearance({ ...appearance, [key]: value })}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>
              <button
                className="button primary create-button"
                type="submit"
                disabled={game.loading || game.pending || name.trim().length < 2}
              >
                {game.loading ? 'Загрузка…' : game.pending ? 'Создаём персонажа…' : 'Войти в Ирий'}
              </button>
              <p className="creation-save-note">Персонаж привязан к этому браузеру.</p>
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
                      За время отсутствия: {player.offlineReport.kills} побед ·{' '}
                      {player.offlineReport.xp} опыта · {player.offlineReport.copper} меди
                    </span>
                    <button onClick={() => setDismissed(reportKey)} aria-label="Скрыть отчёт">
                      <X size={14} />
                    </button>
                  </div>
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
                  <QuestsPanel {...props} />
                ) : page === 'bag' ? (
                  <Inventory {...props} />
                ) : page === 'hero' ? (
                  <HeroPanel {...props} />
                ) : page === 'skills' ? (
                  <SkillsPanel {...props} />
                ) : (
                  <Journal player={player} />
                )}
              </div>
            </>
          )
        )}
      </main>
      {player && (
        <nav className="main-navigation" aria-label="Разделы игры">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={page === id ? 'page' : undefined}
              className={page === id ? 'active' : ''}
              onClick={() => setPage(id)}
            >
              <Icon size={19} strokeWidth={1.5} />
              <span>{label}</span>
              {id === 'quests' &&
                player.quests.some(
                  (q) => q.status === 'active' && q.kills >= QUEST_BY_ID[q.questId].objective.count,
                ) && <i />}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
