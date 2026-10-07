import type { CSSProperties } from 'react';
import {
  ITEM_BY_ID,
  DEFAULT_APPEARANCE,
  type Appearance,
  type ItemDefinition,
  type PublicPlayerState,
} from '@azeroth/game';
import './character-art.css';

export { DEFAULT_APPEARANCE } from '@azeroth/game';
export type { Appearance } from '@azeroth/game';

type VisualItem = ItemDefinition & ItemDefinition['visual'];
type Point = readonly [number, number];
type Box = readonly [number, number, number, number];
type Outfit = { box: Box; neck: Point; grip: Point };
const ATLAS_WIDTH = 1536;
const ATLAS_HEIGHT = 1024;
const FRAME_WIDTH = 220;
const FRAME_HEIGHT = 280;
const NECK: Point = [119, 65];
const BODY_SCALE = 0.418;

// Each painted part is registered to a neck or grip anchor. Adding an outfit is
// an art-manifest change; equipment selection still comes from domain metadata.
const OUTFITS: Record<Appearance['gender'], Record<'cloth' | 'chain' | 'leather', Outfit>> = {
  male: {
    cloth: { box: [137, 0, 385, 512], neck: [335, 20], grip: [175, 122] },
    chain: { box: [586, 0, 386, 512], neck: [782, 20], grip: [619, 122] },
    leather: { box: [1036, 0, 388, 512], neck: [1230, 20], grip: [1064, 123] },
  },
  female: {
    cloth: { box: [137, 512, 385, 512], neck: [335, 538], grip: [176, 634] },
    chain: { box: [586, 512, 386, 512], neck: [780, 538], grip: [620, 634] },
    leather: { box: [1036, 512, 388, 512], neck: [1229, 538], grip: [1064, 634] },
  },
};
const HEAD_COLUMNS = [
  { x: 117, width: 275, neckX: 266 },
  { x: 454, width: 284, neckX: 607 },
  { x: 802, width: 281, neckX: 942 },
  { x: 1151, width: 303, neckX: 1306 },
] as const;
const HEAD_ROWS = {
  dark: { y: 0, height: 342, neckY: 293 },
  fair: { y: 342, height: 337, neckY: 631 },
  red: { y: 679, height: 345, neckY: 967 },
} as const;
const WEAPONS: Record<
  'mace' | 'axe' | 'sword' | 'thunder',
  { box: Box; grip: Point; scale: number; rotate?: number }
> = {
  mace: { box: [235, 0, 176, 522], grip: [321, 399], scale: 0.24 },
  axe: { box: [650, 0, 255, 529], grip: [713, 406], scale: 0.24 },
  sword: { box: [1110, 0, 222, 570], grip: [1211, 105], scale: 0.224, rotate: 180 },
  thunder: { box: [152, 511, 350, 513], grip: [379, 842], scale: 0.245 },
};

export function equippedItem(
  player: PublicPlayerState,
  slot: 'weapon' | 'armor' | 'trinket',
): VisualItem | null {
  const instance = player.inventory.find((item) => item.instanceId === player.equipment[slot]);
  return instance
    ? { ...ITEM_BY_ID[instance.itemId], ...ITEM_BY_ID[instance.itemId].visual }
    : null;
}

function AtlasPart({
  file,
  box,
  position,
  size,
  className = '',
  testId,
  rotate,
}: {
  file: string;
  box: Box;
  position: Point;
  size: Point;
  className?: string;
  testId?: string;
  rotate?: number;
}) {
  const [x, y, width, height] = box;
  const style: CSSProperties = {
    left: `${(position[0] / FRAME_WIDTH) * 100}%`,
    top: `${(position[1] / FRAME_HEIGHT) * 100}%`,
    width: `${(size[0] / FRAME_WIDTH) * 100}%`,
    height: `${(size[1] / FRAME_HEIGHT) * 100}%`,
    backgroundImage: `url("${file}")`,
    backgroundSize: `${(ATLAS_WIDTH / width) * 100}% ${(ATLAS_HEIGHT / height) * 100}%`,
    backgroundPosition: `${width === ATLAS_WIDTH ? 0 : (x / (ATLAS_WIDTH - width)) * 100}% ${height === ATLAS_HEIGHT ? 0 : (y / (ATLAS_HEIGHT - height)) * 100}%`,
    transform: rotate ? `rotate(${rotate}deg)` : undefined,
  };
  return (
    <span
      className={`painted-part ${className}`}
      style={style}
      data-testid={testId}
      aria-hidden="true"
    />
  );
}

function anchoredPosition(
  box: Box,
  sourceAnchor: Point,
  targetAnchor: Point,
  scale: number,
): Point {
  return [
    targetAnchor[0] - (sourceAnchor[0] - box[0]) * scale,
    targetAnchor[1] - (sourceAnchor[1] - box[1]) * scale,
  ];
}

export function CharacterSprite({
  player,
  appearance = DEFAULT_APPEARANCE,
  className = '',
  portrait = false,
}: {
  player?: PublicPlayerState;
  appearance?: Appearance;
  className?: string;
  portrait?: boolean;
}) {
  const look = player?.appearance ?? appearance;
  const armor = player ? equippedItem(player, 'armor') : null;
  const weapon = player ? equippedItem(player, 'weapon') : null;
  const trinket = player ? equippedItem(player, 'trinket') : null;
  const material = armor?.armorStyle ?? 'cloth';
  const outfit = OUTFITS[look.gender][material];
  const bodyPosition = anchoredPosition(outfit.box, outfit.neck, NECK, BODY_SCALE);
  const grip: Point = [
    NECK[0] + (outfit.grip[0] - outfit.neck[0]) * BODY_SCALE,
    NECK[1] + (outfit.grip[1] - outfit.neck[1]) * BODY_SCALE,
  ];
  const headColumn =
    HEAD_COLUMNS[(look.gender === 'female' ? 2 : 0) + (look.hairStyle === 'braid' ? 1 : 0)]!;
  const headRow = HEAD_ROWS[look.hair];
  const headBox: Box = [headColumn.x, headRow.y, headColumn.width, headRow.height];
  const headScale = look.gender === 'female' ? 0.194 : 0.2;
  const headPosition = anchoredPosition(
    headBox,
    [headColumn.neckX, headRow.neckY],
    NECK,
    headScale,
  );
  const headFile = `/art/characters/heads-${look.skin}${look.mark === 'scar' ? '-scar' : ''}.webp`;
  const weaponStyle = weapon?.weaponStyle ?? 'none';
  const weaponArt =
    weaponStyle === 'none' ? null : WEAPONS[weapon?.id === 'thunder-axe' ? 'thunder' : weaponStyle];
  const sourceGrip: Point | null = weaponArt
    ? weaponArt.rotate
      ? [
          weaponArt.box[0] + weaponArt.box[2] - (weaponArt.grip[0] - weaponArt.box[0]),
          weaponArt.box[1] + weaponArt.box[3] - (weaponArt.grip[1] - weaponArt.box[1]),
        ]
      : weaponArt.grip
    : null;
  const trinketBox: Box =
    trinket?.id === 'wolf-fang' ? [617, 562, 294, 435] : [1090, 560, 284, 432];
  return (
    <div
      data-testid="character-avatar"
      data-gender={look.gender}
      data-armor={material}
      data-weapon={weaponStyle}
      data-weapon-id={weapon?.id ?? 'none'}
      data-hair={look.hair}
      data-hairstyle={look.hairStyle}
      data-skin={look.skin}
      data-mark={look.mark}
      data-renderer="painted-atlas"
      className={`character-sprite ${portrait ? 'is-portrait' : ''} ${className}`}
      role="img"
      aria-label={`${look.gender === 'female' ? 'Ратница' : 'Ратник'}: ${armor?.name ?? 'льняная рубаха'}, ${weapon?.name ?? 'без оружия'}`}
    >
      <span className="character-art">
        {weaponArt && sourceGrip && (
          <AtlasPart
            file="/art/characters/equipment.webp"
            box={weaponArt.box}
            position={anchoredPosition(weaponArt.box, sourceGrip, grip, weaponArt.scale)}
            size={[weaponArt.box[2] * weaponArt.scale, weaponArt.box[3] * weaponArt.scale]}
            rotate={weaponArt.rotate}
            className={`sprite-weapon ${weapon?.id === 'thunder-axe' ? 'is-thunder' : ''}`}
            testId="weapon-layer"
          />
        )}
        <AtlasPart
          file={headFile}
          box={headBox}
          position={headPosition}
          size={[headBox[2] * headScale, headBox[3] * headScale]}
          className="character-head"
          testId="head-layer"
        />
        <AtlasPart
          file="/art/characters/outfits.webp"
          box={outfit.box}
          position={bodyPosition}
          size={[outfit.box[2] * BODY_SCALE, outfit.box[3] * BODY_SCALE]}
          className="character-body"
          testId="armor-layer"
        />
        {trinket && (
          <AtlasPart
            file="/art/characters/equipment.webp"
            box={trinketBox}
            position={[107, 69]}
            size={[24, 35]}
            className="character-trinket"
            testId="trinket-layer"
          />
        )}
      </span>
    </div>
  );
}

export function EnemySprite({ mobId, className = '' }: { mobId: string; className?: string }) {
  const box: Box =
    mobId === 'wolf'
      ? [0, 285, 596, 689]
      : mobId === 'kobold'
        ? [520, 0, 530, 1024]
        : [1070, 0, 466, 1024];
  const scale = mobId === 'wolf' ? 0.32 : 0.267;
  const width = box[2] * scale;
  const height = box[3] * scale;
  return (
    <div
      className={`enemy-sprite ${className}`}
      data-mob={mobId}
      data-renderer="painted-atlas"
      role="img"
      aria-label={
        mobId === 'wolf'
          ? 'Лесной волк'
          : mobId === 'kobold'
            ? 'Трухлявый страж'
            : 'Болотный лиходей'
      }
    >
      <span className="enemy-art">
        <AtlasPart
          file="/art/slavic-enemies.webp"
          box={box}
          position={[(FRAME_WIDTH - width) / 2, FRAME_HEIGHT - height]}
          size={[width, height]}
        />
      </span>
    </div>
  );
}
