import type { ItemDefinition, ItemId } from '@azeroth/game';
import './item-art.css';

type Bounds = readonly [number, number, number, number];
interface Atlas {
  source: string;
  width: number;
  height: number;
}
interface ItemFrame {
  atlas: Atlas;
  bounds: Bounds;
}
const ORIGINAL: Atlas = { source: '/art/items-atlas.webp', width: 1254, height: 1254 };
const OUTFITS: Atlas = { source: '/art/outfits-extra-icons.webp', width: 1536, height: 512 };
const EQUIPMENT: Atlas = { source: '/art/equipment-icons.webp', width: 1254, height: 1254 };
const ADORNMENTS: Atlas = {
  source: '/art/equipment-adornments-icons.webp',
  width: 1448,
  height: 1086,
};
const original = (bounds: Bounds): ItemFrame => ({ atlas: ORIGINAL, bounds });
const outfit = (column: number): ItemFrame => ({
  atlas: OUTFITS,
  bounds: [column * 512, 0, 512, 512],
});
const equipment = (bounds: Bounds): ItemFrame => ({ atlas: EQUIPMENT, bounds });
const adornment = (bounds: Bounds): ItemFrame => ({ atlas: ADORNMENTS, bounds });

// Item frames belong to the content, not to a particular panel. The exhaustive
// mapping prevents newly introduced loot from silently rendering an empty slot.
const ITEM_ART: Record<ItemId, ItemFrame> = {
  'training-hammer': original([23, 14, 432, 397]),
  'recruit-vest': original([448, 20, 385, 398]),
  'wolf-fang': original([929, 7, 291, 391]),
  'militia-hammer': original([18, 423, 398, 385]),
  "miner's-boots": original([416, 427, 432, 378]),
  'abbey-tabard': original([892, 427, 326, 380]),
  'defias-blade': original([18, 817, 418, 407]),
  'northshire-signet': original([497, 823, 255, 383]),
  'thunder-axe': original([844, 817, 396, 416]),
  'hunting-coat': outfit(0),
  'watch-mail': outfit(1),
  'oath-lamellar': outfit(2),
  'linen-hood': equipment([48, 39, 251, 273]),
  'watch-helmet': equipment([359, 36, 243, 275]),
  'sun-watch-helmet': equipment([649, 55, 258, 250]),
  'ford-shield': equipment([991, 22, 186, 307]),
  'linen-wraps': equipment([44, 348, 265, 235]),
  'watch-gauntlets': equipment([337, 346, 281, 230]),
  'sun-watch-gloves': equipment([648, 341, 283, 242]),
  'linen-trousers': equipment([67, 597, 230, 287]),
  'watch-greaves': equipment([346, 595, 258, 301]),
  'sun-watch-legs': equipment([652, 595, 262, 305]),
  'reed-dagger': equipment([982, 627, 212, 256]),
  'sun-watch-armor': equipment([29, 901, 310, 324]),
  'birch-shield': equipment([335, 912, 285, 291]),
  'reed-parrying-dagger': equipment([686, 923, 217, 272]),
  'linen-shoes': adornment([30, 105, 332, 275]),
  'watch-boots': adornment([392, 66, 303, 323]),
  'sun-watch-boots': adornment([723, 58, 326, 336]),
  'woven-belt': adornment([1102, 112, 316, 275]),
  'copper-ring': adornment([67, 450, 255, 203]),
  'river-ring': adornment([430, 441, 269, 218]),
  'copper-earring': adornment([807, 437, 225, 240]),
  'river-earring': adornment([1185, 399, 159, 307]),
  'traveller-cloak': adornment([25, 681, 388, 369]),
  'birch-amulet': adornment([480, 684, 158, 346]),
};

export function ItemArt({ item, className = '' }: { item: ItemDefinition; className?: string }) {
  const {
    atlas,
    bounds: [x, y, width, height],
  } = ITEM_ART[item.id];
  const extent = Math.max(width, height) + 8;
  return (
    <span className={`item-art ${className}`} data-item-art={item.id} aria-hidden="true">
      <span
        className="item-art-window"
        style={{
          width: `${(width / extent) * 100}%`,
          height: `${(height / extent) * 100}%`,
          backgroundImage: `url("${atlas.source}")`,
          backgroundSize: `${(atlas.width / width) * 100}% ${(atlas.height / height) * 100}%`,
          backgroundPosition: `${atlas.width === width ? 0 : (x / (atlas.width - width)) * 100}% ${atlas.height === height ? 0 : (y / (atlas.height - height)) * 100}%`,
        }}
      />
    </span>
  );
}
