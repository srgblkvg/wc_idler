import { Coins } from 'lucide-react';
import type { ItemDefinition } from '@azeroth/game';
import { ItemArt } from './ItemArt';
export const slotNames = { weapon: 'Оружие', armor: 'Доспех', trinket: 'Оберег' };
export const rarityNames = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
};
export function Meter({
  value,
  max,
  tone = 'health',
  label,
}: {
  value: number;
  max: number;
  tone?: string;
  label: string;
}) {
  return (
    <div className={`meter ${tone}`}>
      <div className="meter-label">
        <span>{label}</span>
        <b>
          {Math.round(value)} / {max}
        </b>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemax={max}
        aria-valuemin={0}
      >
        <i style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%` }} />
      </div>
    </div>
  );
}
export function Money({ copper }: { copper: number }) {
  return (
    <span className="money">
      <Coins size={14} />
      {copper >= 100 && (
        <>
          {Math.floor(copper / 100)}
          <small>с</small>{' '}
        </>
      )}
      {copper % 100}
      <small>м</small>
    </span>
  );
}
export function ItemSymbol({ item }: { item: ItemDefinition }) {
  return <ItemArt item={item} className={`item-symbol rarity-${item.rarity}`} />;
}
export function StatText({ item }: { item: ItemDefinition }) {
  const labels: Record<string, string> = {
    attack: 'атака',
    armor: 'защита',
    maxHp: 'здоровье',
    maxMana: 'сила',
    critChance: 'крит. шанс',
    hitChance: 'точность',
  };
  return (
    <span>
      {Object.entries(item.stats)
        .map(
          ([key, value]) =>
            `+${key === 'critChance' || key === 'hitChance' ? `${Math.round(value * 1000) / 10}%` : value} ${labels[key] || key}`,
        )
        .join(' · ')}
    </span>
  );
}
export function RarityLegend() {
  return (
    <div className="rarity-legend" aria-label="Редкость предметов">
      {Object.entries(rarityNames).map(([id, name]) => (
        <span className={`rarity-${id}`} key={id}>
          <i />
          {name}
        </span>
      ))}
    </div>
  );
}
export function Knot({ className = '' }: { className?: string }) {
  return (
    <svg className={`folk-knot ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 3L42 21 24 39 6 21Z M24 11L34 21 24 31 14 21Z M7 33L17 43 24 36 31 43 41 33M24 3V39"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
