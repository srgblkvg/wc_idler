import { Coins, Shield, Sparkles, Sword, type LucideIcon } from 'lucide-react';
import type { ItemDefinition } from '@azeroth/game';

export const Cross = ({ small = false }: { small?: boolean }) => (
  <span className={`holy-cross ${small ? 'small' : ''}`} aria-hidden="true">
    ✦
  </span>
);
export function PanelTitle({
  icon: Icon,
  children,
  aside,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="panel-title">
      <h2>
        <Icon size={16} strokeWidth={1.6} />
        {children}
      </h2>
      {aside}
    </div>
  );
}
export function Meter({
  value,
  max,
  tone = 'green',
  label,
  detail,
}: {
  value: number;
  max: number;
  tone?: string;
  label: string;
  detail?: string;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter ${tone}`}>
      <div className="meter-label">
        <span>{label}</span>
        <span>{detail || `${Math.round(value)} / ${max}`}</span>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
export function Money({ copper }: { copper: number }) {
  return (
    <span className="money">
      <Coins size={15} />
      {copper >= 10000 && (
        <>
          <b>{Math.floor(copper / 10000)}</b>
          <small>з</small>
        </>
      )}
      {copper >= 100 && (
        <>
          <b>{Math.floor(copper / 100) % 100}</b>
          <small>с</small>
        </>
      )}
      <b>{copper % 100}</b>
      <small>м</small>
    </span>
  );
}
export function ItemSymbol({ item }: { item: ItemDefinition }) {
  const Icon = item.slot === 'weapon' ? Sword : item.slot === 'armor' ? Shield : Sparkles;
  return (
    <div className={`item-symbol ${item.rarity}`}>
      <Icon size={26} strokeWidth={1.3} />
    </div>
  );
}
export const slotNames = { weapon: 'Оружие', armor: 'Доспех', trinket: 'Аксессуар' };
export function StatText({ item }: { item: ItemDefinition }) {
  return (
    <span>
      {Object.entries(item.stats)
        .map(
          ([key, value]) =>
            `+${value} ${{ attack: 'к атаке', armor: 'к защите', maxHp: 'к здоровью', maxMana: 'к мане' }[key]}`,
        )
        .join(' · ') || 'Без бонусов'}
    </span>
  );
}
