import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gem,
  Grid2X2,
  LockKeyhole,
  Shield,
  Sword,
  X,
} from 'lucide-react';
import {
  ITEM_BY_ID,
  type EquipmentSlot,
  type ItemDefinition,
  type ItemInstance,
  type Stats,
} from '@azeroth/game';
import type { GameProps } from './GamePanels';
import { rarityNames, slotNames } from './Common';
import { ItemArt } from './ItemArt';
import './inventory-grid.css';

const PAGE_SIZE = 16;
const SLOTS = ['weapon', 'armor', 'trinket'] as const;
const SLOT_ICONS = { weapon: Sword, armor: Shield, trinket: Gem };
const STAT_NAMES: Record<keyof Stats, string> = {
  attack: 'Атака',
  armor: 'Защита',
  maxHp: 'Здоровье',
  maxMana: 'Сила',
  critChance: 'Крит. шанс',
  hitChance: 'Точность',
};

function statValue(stat: keyof Stats, value: number) {
  return stat === 'critChance' || stat === 'hitChance'
    ? `${Math.round(value * 1_000) / 10}%`
    : `${value}`;
}

/** A native modal keeps item inspection outside every panel's clipped viewport. */
export function ItemDetails({
  instance,
  player,
  pending,
  act,
  onClose,
}: GameProps & { instance: ItemInstance; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const item = ITEM_BY_ID[instance.itemId];
  const equipped = player.equipment[item.slot] === instance.instanceId;
  const locked = player.level < item.requiredLevel;
  const currentInstance = player.inventory.find(
    (owned) => owned.instanceId === player.equipment[item.slot],
  );
  const current = currentInstance ? ITEM_BY_ID[currentInstance.itemId] : null;
  // Include lost stats as well as gained ones when comparing a replacement.
  const stats = [
    ...new Set([
      ...Object.keys(item.stats),
      ...(!equipped && current ? Object.keys(current.stats) : []),
    ]),
  ] as (keyof Stats)[];

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const equip = async () => {
    if (submitting || pending || (!equipped && locked)) return;
    setSubmitting(true);
    try {
      const success = await act(
        equipped
          ? { type: 'unequip', slot: item.slot }
          : { type: 'equip', itemInstanceId: instance.instanceId },
      );
      if (success) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`item-inspection rarity-${item.rarity}`}
      data-testid="item-detail"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        ];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="item-inspection-card">
        <button
          className="item-inspection-close"
          ref={closeRef}
          aria-label="Закрыть предмет"
          onClick={onClose}
        >
          <X size={19} />
        </button>
        <div className="item-inspection-art">
          <ItemArt item={item} />
        </div>
        <div className="item-inspection-heading">
          <span className="item-inspection-rarity">{rarityNames[item.rarity]}</span>
          <h2 id={titleId}>{item.name}</h2>
          <p>
            {slotNames[item.slot]}
            <span>ур. {item.requiredLevel}</span>
          </p>
        </div>
        <div className="item-inspection-scroll">
          <dl className="item-inspection-stats">
            {stats.map((key) => {
              const value = item.stats[key] || 0;
              const difference = value - (current?.stats[key] || 0);
              return (
                <div key={key}>
                  <dt>{STAT_NAMES[key]}</dt>
                  <dd>
                    <b>
                      {value > 0 ? '+' : ''}
                      {statValue(key, value)}
                    </b>
                    {!equipped && current && difference !== 0 && (
                      <small
                        className={difference > 0 ? 'stat-gain' : 'stat-loss'}
                        title="По сравнению с надетым предметом"
                        aria-label={`${difference > 0 ? 'Больше' : 'Меньше'} на ${statValue(key, Math.abs(difference))}, чем на надетом предмете`}
                      >
                        {difference > 0 ? '↑' : '↓'} {statValue(key, Math.abs(difference))}
                      </small>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="item-inspection-description" id={descriptionId}>
            {item.description}
          </p>
        </div>
        <button
          className="item-equip-button"
          disabled={pending || submitting || (!equipped && locked)}
          onClick={() => void equip()}
        >
          {pending || submitting
            ? '…'
            : equipped
              ? 'Снять'
              : locked
                ? `Нужен ${item.requiredLevel} уровень`
                : 'Надеть'}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}

/** Shared with the character sheet: each equipped item opens the same inspector. */
export function EquipmentSlots({
  player,
  pending,
  act,
  showLabels = true,
  onInspect,
}: GameProps & { showLabels?: boolean; onInspect?: (instanceId: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const instance = player.inventory.find((owned) => owned.instanceId === selected);
  return (
    <>
      <div
        className={`inventory-equipped ${showLabels ? '' : 'without-labels'}`}
        aria-label="Надетое снаряжение"
      >
        {SLOTS.map((slot) => {
          const owned = player.inventory.find(
            (entry) => entry.instanceId === player.equipment[slot],
          );
          const item = owned ? ITEM_BY_ID[owned.itemId] : null;
          const Icon = SLOT_ICONS[slot];
          return (
            <div className="inventory-equipped-cell" key={slot}>
              <button
                className={`inventory-slot equipped-slot ${item ? `rarity-${item.rarity}` : 'vacant-equipment'}`}
                data-testid={`equipment-${slot}`}
                data-item-id={item?.id}
                aria-label={`${slotNames[slot]}: ${item?.name || 'не надето'}`}
                aria-haspopup={item ? 'dialog' : undefined}
                disabled={!owned}
                onClick={() => {
                  if (owned) (onInspect || setSelected)(owned.instanceId);
                }}
              >
                {item ? <ItemArt item={item} /> : <Icon size={25} strokeWidth={1.2} />}
              </button>
              {showLabels && <small>{slotNames[slot]}</small>}
            </div>
          );
        })}
      </div>
      {!onInspect && instance && (
        <ItemDetails
          instance={instance}
          player={player}
          pending={pending}
          act={act}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

export function Inventory({ player, pending, act }: GameProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<EquipmentSlot | 'all'>('all');
  const [page, setPage] = useState(0);
  const visible = [...player.inventory]
    .reverse()
    .filter((owned) => filter === 'all' || ITEM_BY_ID[owned.itemId].slot === filter);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const selectedInstance = player.inventory.find((owned) => owned.instanceId === selected);

  return (
    <section className="inventory-panel" aria-label="Сумка" data-testid="inventory-grid-panel">
      <header className="inventory-heading">
        <h2>Сумка</h2>
        <span>
          {player.inventory.length}
          <small> / 100</small>
        </span>
      </header>
      <EquipmentSlots player={player} pending={pending} act={act} onInspect={setSelected} />
      <div className="inventory-toolbar">
        <span>{filter === 'all' ? 'Все вещи' : slotNames[filter]}</span>
        <div className="inventory-filters" aria-label="Тип предметов">
          {(['all', ...SLOTS] as const).map((slot) => {
            const Icon = slot === 'all' ? Grid2X2 : SLOT_ICONS[slot];
            const name = slot === 'all' ? 'Все вещи' : slotNames[slot];
            return (
              <button
                key={slot}
                aria-label={name}
                title={name}
                aria-pressed={filter === slot}
                onClick={() => {
                  setFilter(slot);
                  setPage(0);
                }}
              >
                <Icon size={17} strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="inventory-grid-space">
        <div className="inventory-slot-grid" role="list" aria-label="Предметы в сумке">
          {Array.from({ length: PAGE_SIZE }, (_, index) => {
            const instance = pageItems[index];
            if (!instance)
              return (
                <div className="inventory-empty-slot" key={`empty-${index}`} aria-hidden="true" />
              );
            const item: ItemDefinition = ITEM_BY_ID[instance.itemId];
            const equipped = player.equipment[item.slot] === instance.instanceId;
            const locked = player.level < item.requiredLevel;
            return (
              <div className="inventory-cell" key={instance.instanceId} role="listitem">
                <button
                  className={`inventory-slot rarity-${item.rarity} ${equipped ? 'is-equipped' : ''}`}
                  data-testid={`inventory-item-${instance.instanceId}`}
                  data-item-id={instance.itemId}
                  data-instance-id={instance.instanceId}
                  data-equipped={equipped}
                  aria-label={`${item.name} · ${rarityNames[item.rarity]}${equipped ? ' · надето' : ''}${locked ? ` · нужен ${item.requiredLevel} уровень` : ''}`}
                  aria-haspopup="dialog"
                  onClick={() => setSelected(instance.instanceId)}
                >
                  <ItemArt item={item} />
                  {equipped && (
                    <span className="inventory-equipped-mark" title="Надето">
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                  )}
                  {locked && (
                    <span className="inventory-locked-mark">
                      <LockKeyhole size={12} />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        {visible.length === 0 && (
          <p className="inventory-empty-message">
            {player.inventory.length === 0 ? 'Сумка пуста' : 'Пока нет'}
          </p>
        )}
      </div>
      <nav className="inventory-pagination" aria-label="Страницы сумки">
        <button
          aria-label="Предыдущая страница"
          disabled={activePage === 0}
          onClick={() => setPage(activePage - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {activePage + 1}
          <small> / {pageCount}</small>
        </span>
        <button
          aria-label="Следующая страница"
          disabled={activePage + 1 >= pageCount}
          onClick={() => setPage(activePage + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </nav>
      {selectedInstance && (
        <ItemDetails
          instance={selectedInstance}
          player={player}
          pending={pending}
          act={act}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
