import type { ItemDefinition, ItemId } from '@azeroth/game';
import './item-art.css';

// One hand-painted atlas. Keeping its mapping beside the renderer makes new loot
// independent of the inventory, character sheet, and combat notification layouts.
// Measured opaque bounds, plus a two-pixel antialiasing margin. Individual atlas
// windows prevent a neighbouring weapon's tip from leaking into another slot.
const ITEM_BOUNDS: Record<ItemId, readonly [number, number, number, number]> = {
  'training-hammer': [26, 14, 410, 393],
  'recruit-vest': [447, 18, 372, 400],
  'wolf-fang': [922, 13, 290, 381],
  'militia-hammer': [13, 426, 400, 381],
  "miner's-boots": [411, 429, 436, 375],
  'abbey-tabard': [888, 428, 324, 377],
  'defias-blade': [19, 819, 410, 401],
  'northshire-signet': [495, 828, 254, 379],
  'thunder-axe': [839, 819, 402, 412],
};

export function ItemArt({ item, className = '' }: { item: ItemDefinition; className?: string }) {
  const [x, y, width, height] = ITEM_BOUNDS[item.id];
  const extent = Math.max(width, height) + 8;
  return (
    <span className={`item-art ${className}`} data-item-art={item.id} aria-hidden="true">
      <span
        className="item-art-window"
        style={{
          width: `${(width / extent) * 100}%`,
          height: `${(height / extent) * 100}%`,
          backgroundSize: `${(1254 / width) * 100}% ${(1254 / height) * 100}%`,
          backgroundPosition: `${(x / (1254 - width)) * 100}% ${(y / (1254 - height)) * 100}%`,
        }}
      />
    </span>
  );
}
