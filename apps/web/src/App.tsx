import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Backpack,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Compass,
  Crown,
  LoaderCircle,
  MapPin,
  ScrollText,
  Shield,
  Swords,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { xpForNextLevel } from '@azeroth/game';
import { Cross, Meter, Money } from './Common';
import { BattlePanel, Inventory, Journal, QuestsPanel, RegionPanel } from './GamePanels';
import { useGame } from './useGame';

type Page = 'adventure' | 'character' | 'inventory' | 'quests' | 'journal';
const pages = [
  { id: 'adventure' as Page, name: 'Приключение', icon: Compass },
  { id: 'character' as Page, name: 'Персонаж', icon: Shield },
  { id: 'inventory' as Page, name: 'Сумка', icon: Backpack },
  { id: 'quests' as Page, name: 'Задания', icon: ScrollText },
  { id: 'journal' as Page, name: 'Хроника', icon: BookOpen },
];
export default function App() {
  const game = useGame();
  const [page, setPage] = useState<Page>('adventure');
  const [name, setName] = useState('');
  const [help, setHelp] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const close = dialog.current?.querySelector<HTMLButtonElement>('button');
    close?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelp(false);
      if (event.key === 'Tab') {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [help]);
  const [dismissedReport, setDismissedReport] = useState<string | null>(null);
  const player = game.player;
  const reportKey = player?.offlineReport ? JSON.stringify(player.offlineReport) : null;
  const report = player?.offlineReport;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('adventure');
          }}
        >
          <Cross />
          <span>
            AZEROTH<span>IDLE</span>
          </span>
        </a>
        <div className="sidebar-rule">
          <span>ЛЕТОПИСЬ ВАШЕГО ГЕРОЯ</span>
        </div>
        <nav aria-label="Главная навигация">
          {pages.map(({ id, name: title, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}
            >
              <Icon size={19} strokeWidth={1.5} />
              <span>{title}</span>
              {id === 'quests' && !!player?.quests.filter((q) => q.status === 'active').length && (
                <span className="nav-count">
                  {player.quests.filter((q) => q.status === 'active').length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-lore">
          <span className="sidebar-lore-emblem">♜</span>
          <p>
            «Да пребудет с тобой Свет.
            <br />
            Да будет крепок твой щит.»
          </p>
          <span>КОДЕКС ПАЛАДИНА</span>
        </div>
        <div className="sidebar-bottom">
          {player ? (
            <button className="profile" onClick={() => setPage('character')}>
              <span className="profile-picture">
                <img src="/art/characters.png" alt="" />
              </span>
              <span>
                <strong>{player.name}</strong>
                <small>Человек · Паладин</small>
              </span>
              <span className="profile-level">{player.level}</span>
            </button>
          ) : (
            <div className="profile">
              <span className="profile-picture guest">
                <Shield size={23} />
              </span>
              <span>
                <strong>Ваш будущий герой</strong>
                <small>Человек · Паладин</small>
              </span>
            </div>
          )}
          <button className="help-link" onClick={() => setHelp(true)}>
            <CircleHelp size={14} />
            Как играть
            <ArrowRight size={13} />
          </button>
          <span className="version-label">АЛЬЯНС · СЕВЕРОЗЕМЬЕ</span>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Восточные королевства</span>
            <ChevronRight size={12} />
            <span>Элвиннский лес</span>
            <ChevronRight size={12} />
            <strong>Североземье</strong>
          </div>
          <div className="topbar-actions">
            <div className="server-status" title="Состояние соединения с игровым сервером">
              {game.connected ? (
                <Wifi size={13} />
              ) : game.loading ? (
                <LoaderCircle className="spin" size={13} />
              ) : (
                <WifiOff size={13} />
              )}
              <i className={game.connected ? 'online' : ''} />
              <span>
                {game.connected
                  ? 'Сервер на связи'
                  : game.loading
                    ? 'Соединение…'
                    : 'Нет соединения'}
              </span>
            </div>
            <button className="topbar-help" onClick={() => setHelp(true)} aria-label="Как играть">
              <CircleHelp size={17} strokeWidth={1.4} />
            </button>
          </div>
        </header>
        <section className="zone-hero">
          <img
            src="/art/northshire.png"
            alt="Средневековое аббатство Североземья среди зелёных холмов"
          />
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="hero-kicker">
              <span className="hero-line" />
              ПЕРВАЯ ГЛАВА ВАШЕЙ ИСТОРИИ
            </div>
            <h1>
              Североземье<span>.</span>
            </h1>
            <p>Большие легенды начинаются с маленьких подвигов.</p>
            <div className="hero-tags">
              <span>
                <MapPin size={13} />
                Элвиннский лес
              </span>
              <span>
                <Shield size={13} />
                Территория Альянса
              </span>
              <span>Уровни 1–5</span>
            </div>
          </div>
          <span className="hero-corner">I</span>
        </section>
        {game.error && (
          <div className="error-banner" role="alert">
            <WifiOff size={17} />
            <span>{game.error}</span>
            <button onClick={() => void game.refresh()} disabled={game.pending}>
              Повторить
            </button>
          </div>
        )}
        {!player ? (
          <section className="welcome panel">
            <div className="welcome-story">
              <span className="eyebrow">НОВАЯ ИСТОРИЯ · НОВЫЙ ГЕРОЙ</span>
              <h2>
                Ваш путь начинается
                <br />у стен аббатства.
              </h2>
              <p>
                Примите присягу паладина, защитите Североземье и обретите своё первое снаряжение.
                Мир продолжает жить, даже когда вы закрываете вкладку.
              </p>
              <div className="welcome-features">
                <span>
                  <Swords size={18} />
                  Автоматические сражения
                </span>
                <span>
                  <ScrollText size={18} />
                  Задания и награды
                </span>
                <span>
                  <Users size={18} />
                  Личный прогресс на сервере
                </span>
              </div>
            </div>
            <form
              className="create-character"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) void game.create(name.trim());
              }}
            >
              <div className="creation-seal">
                <Crown size={29} strokeWidth={1.2} />
              </div>
              <h3>Призвание — защищать.</h3>
              <p>Человек · Паладин</p>
              <label htmlFor="character-name">ИМЯ ПЕРСОНАЖА</label>
              <input
                id="character-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как зовут вашего героя?"
                minLength={2}
                maxLength={24}
                required
                autoComplete="off"
                disabled={game.pending || game.loading}
              />
              <button
                className="button primary"
                type="submit"
                disabled={game.pending || game.loading || name.trim().length < 2}
              >
                {game.pending || game.loading ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
                {game.loading
                  ? 'Загрузка мира…'
                  : game.pending
                    ? 'Пишем первую страницу…'
                    : 'Начать приключение'}
              </button>
              <small>
                Прогресс сохраняется автоматически.
                <br />
                Этот браузер — ключ к вашему персонажу.
              </small>
            </form>
          </section>
        ) : (
          <>
            <section className="player-strip">
              <div className="player-summary">
                <span className="level-medallion">
                  {player.level}
                  <small>УР.</small>
                </span>
                <div>
                  <h2>
                    {player.name}
                    <span>Паладин</span>
                  </h2>
                  <p>
                    <Shield size={12} />
                    Человек · Североземье
                  </p>
                </div>
              </div>
              <div className="xp-summary">
                <Meter
                  value={player.xp}
                  max={xpForNextLevel(player.level)}
                  tone="gold"
                  label={`Уровень ${player.level}`}
                  detail={`${player.xp} / ${xpForNextLevel(player.level)} опыта`}
                />
              </div>
              <div className="wallet">
                <span className="eyebrow">ВАША КАЗНА</span>
                <Money copper={player.copper} />
              </div>
              <div className="kills-stat">
                <span className="eyebrow">ПОБЕДЫ</span>
                <strong>
                  <Swords size={15} />
                  {player.totalKills}
                </strong>
              </div>
            </section>
            {report && reportKey !== dismissedReport && report.elapsedMs >= 60000 && (
              <div className="offline-banner">
                <BookOpen size={18} />
                <div>
                  <strong>Пока вы были в пути</strong>
                  <span>
                    {report.kills} побед · +{report.xp} опыта · +{report.copper} меди ·{' '}
                    {report.items} предметов
                    {report.capped ? ' · достигнут предел офлайн-прогресса' : ''}
                  </span>
                </div>
                <button onClick={() => setDismissedReport(reportKey)} aria-label="Скрыть отчёт">
                  <X size={17} />
                </button>
              </div>
            )}
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {page === 'adventure'
                    ? 'ДОБРО ПОЖАЛОВАТЬ В СЕВЕРОЗЕМЬЕ'
                    : 'СТРАНИЦЫ ВАШЕЙ ИСТОРИИ'}
                </span>
                <h2>{pages.find((p) => p.id === page)?.name}</h2>
              </div>
              <span className="saved-status">
                <span className="small-dot" />
                {game.pending
                  ? 'Сохраняем…'
                  : game.connected
                    ? 'Прогресс сохранён'
                    : 'Ожидаем соединения'}
              </span>
            </div>
            {page === 'adventure' ? (
              <>
                <div className="adventure-grid">
                  <RegionPanel player={player} pending={game.pending} act={game.act} />
                  <BattlePanel player={player} pending={game.pending} act={game.act} />
                  <QuestsPanel player={player} pending={game.pending} act={game.act} />
                </div>
                <Journal player={player} />
              </>
            ) : page === 'character' || page === 'inventory' ? (
              <Inventory
                player={player}
                pending={game.pending}
                act={game.act}
                character={page === 'character'}
              />
            ) : page === 'quests' ? (
              <QuestsPanel player={player} pending={game.pending} act={game.act} full />
            ) : (
              <Journal player={player} expanded />
            )}
          </>
        )}
        <footer className="page-footer">
          <span>
            <Cross small />
            Каждое приключение достойно летописи.
          </span>
          <span>
            AZEROTH IDLE <b>·</b> НЕОФИЦИАЛЬНЫЙ ФАНАТСКИЙ ПРОЕКТ
          </span>
        </footer>
      </main>
      {help && (
        <div className="modal-overlay" onClick={() => setHelp(false)}>
          <section
            ref={dialog}
            className="help-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" aria-label="Закрыть" onClick={() => setHelp(false)}>
              <X size={20} />
            </button>
            <Cross />
            <h2 id="help-title">
              Маленькие шаги.
              <br />
              Большие подвиги.
            </h2>
            <ol>
              <li>
                <strong>Примите задания.</strong> В журнале заданий нажмите «Принять задание» —
                теперь победы засчитываются.
              </li>
              <li>
                <strong>Выберите противника.</strong> Нажмите на обитателя окрестностей, чтобы
                начать автоматическую охоту.
              </li>
              <li>
                <strong>Снарядите героя.</strong> Откройте сумку и наденьте добытые предметы.
                Сдавайте задания ради наград.
              </li>
              <li>
                <strong>Отдыхайте и возвращайтесь.</strong> Отдых восстанавливает силы. Охота
                продолжается на сервере после закрытия вкладки.
              </li>
            </ol>
            <p>
              Храните данные этого браузера: cookie связывает вас с персонажем. У каждого игрока
              свой прогресс в общей базе данных.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              За Свет и Альянс
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
