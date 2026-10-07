import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ArmorIcon,
  PantsIcon,
  RingIcon,
  EarringIcon,
  BeltIcon,
  CloakIcon,
  AmuletIcon,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Gem,
  Grid2X2,
  Hand,
  HardHat,
  LockKeyhole,
  Shield,
  Sword,
  X,
} from './UiIcons';
import {
  ITEM_BY_ID,
  EQUIPMENT_SLOTS,
  getEquipConflict,
  getEquipSlot,
  getEquippedItem,
  type EquipmentSlot,
  type ItemDefinition,
  type ItemInstance,
  type SkillId,
  type Stats,
} from '@azeroth/game';
import type { GameProps } from './GamePanels';
import { rarityNames, slotNames } from './Common';
import { ItemArt } from './ItemArt';
import { SkillButton, SkillDetails } from './SkillControls';
import './inventory-grid.css';

const PAGE_SIZE = 16;
const EQUIPMENT_GROUPS = {
  combat: ['weapon', 'offhand', 'armor', 'helmet', 'gloves', 'legs', 'feet'],
  accessories: ['ring1', 'ring2', 'earring1', 'earring2', 'belt', 'cloak', 'amulet'],
} as const;
const SLOT_ICONS = {
  weapon: Sword,
  offhand: Shield,
  armor: ArmorIcon,
  helmet: HardHat,
  gloves: Hand,
  legs: PantsIcon,
  feet: Footprints,
  ring1: RingIcon,
  ring2: RingIcon,
  earring1: EarringIcon,
  earring2: EarringIcon,
  belt: BeltIcon,
  cloak: CloakIcon,
  amulet: AmuletIcon,
};
const FILTERS = [
  { id: 'all', name: 'Все вещи', icon: Grid2X2 },
  { id: 'weapon', name: 'Оружие', icon: Sword },
  { id: 'armor', name: 'Доспех', icon: ArmorIcon },
  { id: 'offhand', name: 'Левая рука', icon: Shield },
  { id: 'accessories', name: 'Украшения', icon: Gem },
] as const;
type InventoryFilter = (typeof FILTERS)[number]['id'];
const ARMOR_SLOTS: readonly EquipmentSlot[] = ['armor', 'helmet', 'gloves', 'legs', 'feet'];
const ACCESSORY_SLOTS: readonly EquipmentSlot[] = EQUIPMENT_GROUPS.accessories;
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
  const [skillDetail, setSkillDetail] = useState<SkillId | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const item = ITEM_BY_ID[instance.itemId];
  const equippedSlot = EQUIPMENT_SLOTS.find(
    (slot) => player.equipment[slot] === instance.instanceId,
  );
  const equipped = !!equippedSlot;
  const [targetSlot, setTargetSlot] = useState<EquipmentSlot>(
    () => equippedSlot || getEquipSlot(player, item),
  );
  const conflict = equipped ? null : getEquipConflict(player, item, targetSlot);
  const offhand = getEquippedItem(player, 'offhand');
  const freesOffhand =
    !equipped &&
    !!offhand &&
    item.slot === 'weapon' &&
    (item.handType === 'twoHand' ||
      (offhand.offhandType === 'dagger' && item.visual.weaponStyle !== 'dagger'));
  const kind =
    item.slot === 'weapon'
      ? item.handType === 'twoHand'
        ? 'Двуручное'
        : 'Одноручное'
      : item.slot === 'offhand'
        ? item.offhandType === 'shield'
          ? 'Щит'
          : item.offhandType === 'dagger'
            ? 'Парный кинжал'
            : 'Оберег'
        : slotNames[targetSlot];
  const currentInstance = player.inventory.find(
    (owned) => owned.instanceId === player.equipment[targetSlot],
  );
  const current = currentInstance ? ITEM_BY_ID[currentInstance.itemId] : null;
  // Include lost stats as well as gained ones when comparing a replacement.
  const stats = [
    ...new Set([
      ...Object.keys(item.stats),
      ...(!equipped && current ? Object.keys(current.stats) : []),
      ...(freesOffhand ? Object.keys(offhand.stats) : []),
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
    if (submitting || pending || conflict) return;
    setSubmitting(true);
    try {
      const success = await act(
        equipped
          ? { type: 'unequip', slot: equippedSlot }
          : { type: 'equip', itemInstanceId: instance.instanceId, slot: targetSlot },
      );
      if (success) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <>
      <dialog
        ref={dialogRef}
        className={`item-inspection rarity-${item.rarity}`}
        data-testid="item-detail"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (skillDetail) return;
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
              {kind}
              <span>ур. {item.requiredLevel}</span>
            </p>
          </div>
          <div className="item-inspection-scroll">
            {!equipped && item.equipSlots && item.equipSlots.length > 1 && (
              <div className="item-slot-choice" aria-label="Куда надеть">
                {item.equipSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={targetSlot === slot}
                    data-testid={`target-slot-${slot}`}
                    onClick={() => setTargetSlot(slot)}
                  >
                    {slotNames[slot]}
                  </button>
                ))}
              </div>
            )}
            <dl className="item-inspection-stats">
              {stats.map((key) => {
                const value = item.stats[key] || 0;
                const difference =
                  value - (current?.stats[key] || 0) - (freesOffhand ? offhand.stats[key] || 0 : 0);
                return (
                  <div key={key}>
                    <dt>{STAT_NAMES[key]}</dt>
                    <dd>
                      <b>
                        {value > 0 ? '+' : ''}
                        {statValue(key, value)}
                      </b>
                      {!equipped && (current || freesOffhand) && difference !== 0 && (
                        <small
                          className={difference > 0 ? 'stat-gain' : 'stat-loss'}
                          title="Изменение после замены снаряжения"
                          aria-label={`${difference > 0 ? 'Больше' : 'Меньше'} на ${statValue(key, Math.abs(difference))} после замены снаряжения`}
                        >
                          {difference > 0 ? '↑' : '↓'} {statValue(key, Math.abs(difference))}
                        </small>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {!!item.grantedSkills.length && (
              <div className="item-granted-skills" aria-label="Приёмы предмета">
                {item.grantedSkills.map((id) => (
                  <SkillButton key={id} id={id} onClick={() => setSkillDetail(id)} />
                ))}
              </div>
            )}
            <p className="item-inspection-description" id={descriptionId}>
              {item.description}
            </p>
          </div>
          <div className="item-inspection-action">
            {(conflict || freesOffhand) && (
              <p className="item-equip-note" role="note">
                {conflict || 'Предмет из левой руки вернётся в сумку.'}
              </p>
            )}
            <button
              className="item-equip-button"
              disabled={pending || submitting || !!conflict}
              title={conflict || undefined}
              onClick={() => void equip()}
            >
              {pending || submitting ? '…' : equipped ? 'Снять' : 'Надеть'}
            </button>
          </div>
        </div>
      </dialog>
      {skillDetail && (
        <SkillDetails id={skillDetail} source={item.name} onClose={() => setSkillDetail(null)} />
      )}
    </>,
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
  const [group, setGroup] = useState<keyof typeof EQUIPMENT_GROUPS>('combat');
  const instance = player.inventory.find((owned) => owned.instanceId === selected);
  const twoHanded = getEquippedItem(player, 'weapon')?.handType === 'twoHand';
  return (
    <>
      <div className="equipment-tabs" aria-label="Группа снаряжения">
        <button type="button" aria-pressed={group === 'combat'} onClick={() => setGroup('combat')}>
          Боевые
        </button>
        <button
          type="button"
          aria-pressed={group === 'accessories'}
          onClick={() => setGroup('accessories')}
        >
          Украшения
        </button>
      </div>
      <div
        className={`inventory-equipped ${showLabels ? '' : 'without-labels'}`}
        aria-label="Надетое снаряжение"
      >
        {EQUIPMENT_GROUPS[group].map((slot) => {
          const owned = player.inventory.find(
            (entry) => entry.instanceId === player.equipment[slot],
          );
          const item = owned ? ITEM_BY_ID[owned.itemId] : null;
          const Icon = SLOT_ICONS[slot];
          const blocked = slot === 'offhand' && twoHanded;
          return (
            <div className="inventory-equipped-cell" key={slot}>
              <button
                className={`inventory-slot equipped-slot ${item ? `rarity-${item.rarity}` : 'vacant-equipment'}`}
                data-testid={`equipment-${slot}`}
                data-item-id={item?.id}
                aria-label={`${slotNames[slot]}: ${blocked ? 'занята двуручным оружием' : item?.name || 'не надето'}`}
                title={blocked ? 'Занята двуручным оружием' : slotNames[slot]}
                data-blocked={blocked || undefined}
                aria-haspopup={item ? 'dialog' : undefined}
                disabled={!owned}
                onClick={() => {
                  if (owned) (onInspect || setSelected)(owned.instanceId);
                }}
              >
                {item ? (
                  <ItemArt item={item} />
                ) : blocked ? (
                  <LockKeyhole size={23} strokeWidth={1.2} />
                ) : (
                  <Icon size={36} />
                )}
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
  const [view, setView] = useState<'bag' | 'equipment'>('bag');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [page, setPage] = useState(0);
  const visible = [...player.inventory].reverse().filter((owned) => {
    const slot = ITEM_BY_ID[owned.itemId].slot;
    return (
      filter === 'all' ||
      (filter === 'armor'
        ? ARMOR_SLOTS.includes(slot)
        : filter === 'accessories'
          ? ACCESSORY_SLOTS.includes(slot)
          : slot === filter)
    );
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const selectedInstance = player.inventory.find((owned) => owned.instanceId === selected);

  return (
    <section
      className={`inventory-panel inventory-view-${view}`}
      aria-label="Сумка"
      data-testid="inventory-grid-panel"
    >
      <header className="inventory-heading">
        <div className="inventory-view-tabs" aria-label="Сумка и снаряжение">
          <button type="button" aria-pressed={view === 'bag'} onClick={() => setView('bag')}>
            Сумка
          </button>
          <button
            type="button"
            aria-pressed={view === 'equipment'}
            onClick={() => setView('equipment')}
          >
            Снаряжение
          </button>
        </div>
        <span>
          {player.inventory.length}
          <small> / 100</small>
        </span>
      </header>
      {view === 'equipment' ? (
        <div className="inventory-gear-view">
          <EquipmentSlots player={player} pending={pending} act={act} onInspect={setSelected} />
        </div>
      ) : (
        <>
          <div className="inventory-toolbar">
            <span>{FILTERS.find((entry) => entry.id === filter)?.name}</span>
            <div className="inventory-filters" aria-label="Тип предметов">
              {FILTERS.map(({ id, name, icon: Icon }) => {
                return (
                  <button
                    key={id}
                    aria-label={name}
                    title={name}
                    aria-pressed={filter === id}
                    data-filter={id}
                    onClick={() => {
                      setFilter(id);
                      setPage(0);
                    }}
                  >
                    <Icon size={28} />
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
                    <div
                      className="inventory-empty-slot"
                      key={`empty-${index}`}
                      aria-hidden="true"
                    />
                  );
                const item: ItemDefinition = ITEM_BY_ID[instance.itemId];
                const equipped = Object.values(player.equipment).includes(instance.instanceId);
                const conflict = equipped ? null : getEquipConflict(player, item);
                return (
                  <div className="inventory-cell" key={instance.instanceId} role="listitem">
                    <button
                      className={`inventory-slot rarity-${item.rarity} ${equipped ? 'is-equipped' : ''}`}
                      data-testid={`inventory-item-${instance.instanceId}`}
                      data-item-id={instance.itemId}
                      data-instance-id={instance.instanceId}
                      data-equipped={equipped}
                      aria-label={`${item.name} · ${rarityNames[item.rarity]}${equipped ? ' · надето' : ''}${conflict ? ` · ${conflict}` : ''}`}
                      aria-haspopup="dialog"
                      onClick={() => setSelected(instance.instanceId)}
                    >
                      <ItemArt item={item} />
                      {equipped && (
                        <span className="inventory-equipped-mark" title="Надето">
                          <Check size={12} strokeWidth={2.5} />
                        </span>
                      )}
                      {conflict && (
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
        </>
      )}
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
