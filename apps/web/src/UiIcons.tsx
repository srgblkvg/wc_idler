import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

const FRAMES: readonly (readonly [number, number, number, number])[] = [
  [37, 46, 237, 213],
  [303, 48, 221, 210],
  [564, 50, 204, 218],
  [813, 55, 186, 199],
  [1054, 48, 207, 206],
  [1305, 50, 199, 206],
  [38, 298, 230, 201],
  [317, 362, 200, 65],
  [573, 332, 189, 152],
  [806, 274, 195, 235],
  [1037, 293, 234, 225],
  [1317, 275, 177, 238],
  [40, 531, 216, 198],
  [326, 529, 187, 193],
  [566, 527, 197, 206],
  [814, 559, 181, 149],
  [1122, 536, 59, 210],
  [1296, 557, 206, 184],
  [32, 757, 232, 230],
  [331, 760, 141, 206],
  [543, 768, 224, 202],
  [792, 751, 226, 233],
  [1062, 753, 228, 231],
  [1300, 751, 210, 229],
];

/** One painted atlas for navigation and empty equipment slots. No icon font. */
function painted(index: number, name: string) {
  return function PaintedUiIcon({ size = 24, className = '', style }: IconProps) {
    const [x, y, width, height] = FRAMES[index]!;
    const extent = Math.max(width, height) + 8;
    return (
      <span
        className={`ui-icon ui-icon-${name} ${className}`}
        aria-hidden="true"
        data-ui-icon={name}
        style={{
          display: 'inline-block',
          flexShrink: 0,
          width: size,
          height: size,
          verticalAlign: 'middle',
          position: 'relative',
          ...style,
        }}
      >
        <span
          className="ui-icon-paint"
          style={{
            position: 'absolute',
            display: 'block',
            width: `${(width / extent) * 100}%`,
            height: `${(height / extent) * 100}%`,
            left: `${(1 - width / extent) * 50}%`,
            top: `${(1 - height / extent) * 50}%`,
            backgroundImage: 'url("/art/ui-icons.webp")',
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${(1536 / width) * 100}% ${(1024 / height) * 100}%`,
            backgroundPosition: `${(x / (1536 - width)) * 100}% ${(y / (1024 - height)) * 100}%`,
          }}
        />
      </span>
    );
  };
}

// Plain typographic controls stay legible at the smallest button size.
function control(symbol: string, name: string) {
  return function UiControl({ size = 18, className = '', style }: IconProps) {
    return (
      <span
        aria-hidden="true"
        className={`ui-control ui-control-${name} ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: size,
          height: size,
          fontSize: size,
          lineHeight: 1,
          ...style,
        }}
      >
        {symbol}
      </span>
    );
  };
}

export const Swords = painted(0, 'battle');
export const Map = painted(1, 'map');
export const ScrollText = painted(2, 'quests');
export const Backpack = painted(3, 'bag');
export const Shield = painted(4, 'shield');
export const WandSparkles = painted(5, 'abilities');
export const BookOpen = painted(6, 'chronicle');
export const MoreHorizontal = painted(7, 'more');
export const Coins = painted(8, 'coins');
export const Sword = painted(9, 'weapon');
export const ArmorIcon = painted(10, 'armor');
export const HardHat = painted(11, 'helmet');
export const Hand = painted(12, 'gloves');
export const PantsIcon = painted(13, 'legs');
export const Footprints = painted(14, 'feet');
export const RingIcon = painted(15, 'ring');
export const EarringIcon = painted(16, 'earring');
export const BeltIcon = painted(17, 'belt');
export const CloakIcon = painted(18, 'cloak');
export const AmuletIcon = painted(19, 'amulet');
export const Gem = AmuletIcon;
export const Grid2X2 = painted(20, 'inventory');
export const Flame = painted(21, 'campfire');
export const ClaimIcon = painted(22, 'claim');
export const MapPin = painted(23, 'location');
export const X = control('×', 'close');
export const ArrowLeft = control('←', 'back');
export const ArrowRight = control('→', 'next');
export const ChevronLeft = control('‹', 'previous');
export const ChevronRight = control('›', 'next-page');
export const ChevronDown = control('⌄', 'expand');
export const Check = control('✓', 'check');
export const CirclePause = control('Ⅱ', 'pause');
export const LockKeyhole = control('—', 'unavailable');
export const Wifi = control('●', 'connected');
export const WifiOff = control('○', 'disconnected');
