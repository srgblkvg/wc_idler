import type { CSSProperties } from 'react';
import {
  ITEM_BY_ID,
  DEFAULT_APPEARANCE,
  type Appearance,
  type EquipmentSlot,
  type ItemDefinition,
  type PublicPlayerState,
} from '@azeroth/game';
import './character-art.css';

export { DEFAULT_APPEARANCE } from '@azeroth/game';
export type { Appearance } from '@azeroth/game';

type VisualItem = ItemDefinition & ItemDefinition['visual'];
type Point = readonly [number, number];
type Box = readonly [number, number, number, number];
type Outfit = { box: Box; neck: Point; grip: Point; offGrip: Point; scale: number };
const ATLAS_WIDTH = 1536;
const ATLAS_HEIGHT = 1024;
const FRAME_WIDTH = 220;
const FRAME_HEIGHT = 280;
const NECK: Point = [119, 65];
const HEAD_JOIN: Point = [119, 70];

// Each painted part is registered to a neck or grip anchor. Adding an outfit is
// an art-manifest change; equipment selection still comes from domain metadata.
const OUTFITS: Record<Appearance['gender'], Record<'cloth' | 'chain' | 'leather', Outfit>> = {
  male: {
    cloth: {
      box: [85, 19, 433, 428],
      neck: [340, 40],
      grip: [120, 180],
      offGrip: [386, 267],
      scale: 0.31,
    },
    chain: {
      box: [541, 21, 435, 418],
      neck: [786, 40],
      grip: [576, 180],
      offGrip: [833, 267],
      scale: 0.31,
    },
    leather: {
      box: [1014, 18, 450, 428],
      neck: [1275, 40],
      grip: [1051, 180],
      offGrip: [1326, 267],
      scale: 0.31,
    },
  },
  female: {
    cloth: {
      box: [85, 507, 430, 429],
      neck: [340, 530],
      grip: [120, 666],
      offGrip: [386, 747],
      scale: 0.31,
    },
    chain: {
      box: [541, 510, 434, 419],
      neck: [786, 530],
      grip: [576, 668],
      offGrip: [833, 747],
      scale: 0.31,
    },
    leather: {
      box: [1014, 506, 446, 429],
      neck: [1275, 530],
      grip: [1051, 666],
      offGrip: [1326, 747],
      scale: 0.31,
    },
  },
};
// Each additional outfit keeps its own measured collar and hand registration.
const EXTRA_OUTFITS: Record<
  Appearance['gender'],
  Record<NonNullable<ItemDefinition['visual']['armorVariant']>, Outfit>
> = {
  male: {
    hunter: {
      box: [85, 79, 418, 399],
      neck: [331, 105],
      grip: [118, 228],
      offGrip: [376, 307],
      scale: 0.335,
    },
    watch: {
      box: [534, 84, 466, 414],
      neck: [780, 105],
      grip: [568, 230],
      offGrip: [822, 309],
      scale: 0.335,
    },
    oath: {
      box: [1001, 80, 422, 419],
      neck: [1249, 105],
      grip: [1036, 230],
      offGrip: [1283, 308],
      scale: 0.335,
    },
    sun: {
      box: [536, 1, 501, 457],
      neck: [787, 24],
      grip: [570, 166],
      offGrip: [846, 248],
      scale: 0.31,
    },
  },
  female: {
    hunter: {
      box: [85, 560, 418, 393],
      neck: [331, 585],
      grip: [118, 708],
      offGrip: [376, 786],
      scale: 0.335,
    },
    watch: {
      box: [534, 564, 466, 404],
      neck: [780, 585],
      grip: [568, 710],
      offGrip: [822, 789],
      scale: 0.335,
    },
    oath: {
      box: [1001, 560, 422, 419],
      neck: [1249, 585],
      grip: [1036, 710],
      offGrip: [1283, 788],
      scale: 0.335,
    },
    sun: {
      box: [536, 511, 501, 461],
      neck: [787, 535],
      grip: [570, 684],
      offGrip: [849, 761],
      scale: 0.31,
    },
  },
};
const HEAD_COLUMNS = [
  { x: 117, width: 275, neckX: 266 },
  { x: 454, width: 284, neckX: 607 },
  { x: 790, width: 315, neckX: 942 },
  { x: 1151, width: 321, neckX: 1306 },
] as const;
const HEAD_ROWS = {
  dark: { y: 0, height: 335, neckY: 293 },
  fair: { y: 328, height: 329, neckY: 631 },
  red: { y: 650, height: 374, neckY: 967 },
} as const;
const WEAPONS: Record<
  'mace' | 'axe' | 'sword' | 'thunder' | 'dagger',
  { box: Box; grip: Point; scale: number; rotate?: number; file?: string }
> = {
  mace: { box: [235, 0, 176, 522], grip: [321, 399], scale: 0.24 },
  axe: { box: [650, 0, 255, 529], grip: [713, 406], scale: 0.24 },
  sword: { box: [1110, 0, 222, 570], grip: [1211, 105], scale: 0.224, rotate: 180 },
  thunder: { box: [152, 511, 350, 513], grip: [379, 842], scale: 0.245 },
  dagger: {
    box: [1295, 665, 77, 322],
    grip: [1333, 717],
    scale: 0.2,
    rotate: 180,
    file: '/art/characters/accessories.webp',
  },
};
const ACCESSORIES_FILE = '/art/characters/accessories.webp';
type WearStyle = 'cloth' | 'iron' | 'sun';
const HELMETS: Record<WearStyle, Box> = {
  cloth: [115, 58, 244, 265],
  iron: [490, 36, 230, 288],
  sun: [837, 39, 226, 286],
};
const GLOVES: Record<WearStyle, { main: Box; off: Box }> = {
  cloth: { main: [54, 457, 169, 117], off: [219, 446, 152, 159] },
  iron: { main: [421, 446, 176, 125], off: [601, 439, 168, 169] },
  sun: { main: [813, 458, 179, 120], off: [990, 441, 169, 168] },
};
const LOWER_BODY: Record<WearStyle, { box: Box; knee: number }> = {
  cloth: { box: [36, 636, 345, 339], knee: 750 },
  iron: { box: [427, 635, 356, 347], knee: 741 },
  sun: { box: [804, 634, 358, 345], knee: 741 },
};
const OFFHANDS: Record<'shield' | 'talisman' | 'dagger', { box: Box; grip: Point; scale: number }> =
  {
    shield: { box: [1160, 22, 325, 319], grip: [1322, 178], scale: 0.255 },
    talisman: { box: [1272, 360, 124, 283], grip: [1320, 570], scale: 0.21 },
    dagger: { box: WEAPONS.dagger.box, grip: WEAPONS.dagger.grip, scale: 0.2 },
  };
function wearStyle(item: VisualItem | null): WearStyle {
  return item?.accessoryStyle === 'iron' || item?.accessoryStyle === 'sun'
    ? item.accessoryStyle
    : 'cloth';
}

export function equippedItem(player: PublicPlayerState, slot: EquipmentSlot): VisualItem | null {
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
  variant = 'figure',
}: {
  player?: PublicPlayerState;
  appearance?: Appearance;
  className?: string;
  portrait?: boolean;
  variant?: 'figure' | 'avatar';
}) {
  const look = player?.appearance ?? appearance;
  const armor = player ? equippedItem(player, 'armor') : null;
  const weapon = player
    ? equippedItem(player, 'weapon')
    : !portrait && variant !== 'avatar'
      ? { ...ITEM_BY_ID['training-hammer'], ...ITEM_BY_ID['training-hammer'].visual }
      : null;
  const helmet = player ? equippedItem(player, 'helmet') : null;
  const gloves = player ? equippedItem(player, 'gloves') : null;
  const legs = player ? equippedItem(player, 'legs') : null;
  const feet = player ? equippedItem(player, 'feet') : null;
  const offhand = player ? equippedItem(player, 'offhand') : null;
  const material = armor?.armorStyle ?? 'cloth';
  const armorVariant = armor?.armorVariant;
  const outfit = armorVariant
    ? EXTRA_OUTFITS[look.gender][armorVariant]
    : OUTFITS[look.gender][material];
  const outfitFile =
    armorVariant === 'sun'
      ? '/art/characters/outfits-sun-upper.webp'
      : armorVariant
        ? '/art/characters/outfits-extra-upper.webp'
        : '/art/characters/outfits-upper.webp';
  const bodyPosition = anchoredPosition(outfit.box, outfit.neck, NECK, outfit.scale);
  const grip: Point = [
    NECK[0] + (outfit.grip[0] - outfit.neck[0]) * outfit.scale,
    NECK[1] + (outfit.grip[1] - outfit.neck[1]) * outfit.scale,
  ];
  const offGrip: Point = [
    NECK[0] + (outfit.offGrip[0] - outfit.neck[0]) * outfit.scale,
    NECK[1] + (outfit.offGrip[1] - outfit.neck[1]) * outfit.scale,
  ];
  const headColumn =
    HEAD_COLUMNS[(look.gender === 'female' ? 2 : 0) + (look.hairStyle === 'braid' ? 1 : 0)]!;
  const headRow = HEAD_ROWS[look.hair];
  const headBox: Box = [headColumn.x, headRow.y, headColumn.width, headRow.height];
  const headScale = look.gender === 'female' ? 0.172 : 0.168;
  const headPosition = anchoredPosition(
    headBox,
    [headColumn.neckX, headRow.neckY],
    HEAD_JOIN,
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
  const helmetBox = helmet ? HELMETS[wearStyle(helmet)] : null;
  const gloveArt = gloves ? GLOVES[wearStyle(gloves)] : null;
  const pants = LOWER_BODY[wearStyle(legs)];
  const boots = LOWER_BODY[wearStyle(feet)];
  const pantsBox: Box = [pants.box[0], pants.box[1], pants.box[2], pants.knee - pants.box[1] + 4];
  const bootsBox: Box = [
    boots.box[0],
    boots.knee,
    boots.box[2],
    boots.box[1] + boots.box[3] - boots.knee,
  ];
  const starterBoots: Box = look.gender === 'male' ? [186, 350, 288, 161] : [188, 862, 291, 157];
  const offhandArt = offhand?.offhandType ? OFFHANDS[offhand.offhandType] : null;
  return (
    <div
      data-testid="character-avatar"
      data-gender={look.gender}
      data-armor={material}
      data-armor-variant={armorVariant ?? material}
      data-weapon={weaponStyle}
      data-weapon-id={weapon?.id ?? 'none'}
      data-helmet={helmet?.id ?? 'none'}
      data-gloves={gloves?.id ?? 'none'}
      data-legs={legs?.id ?? 'none'}
      data-feet={feet?.id ?? 'none'}
      data-offhand={offhand?.id ?? 'none'}
      data-hair={look.hair}
      data-hairstyle={look.hairStyle}
      data-skin={look.skin}
      data-mark={look.mark}
      data-renderer="painted-atlas"
      data-facing="right"
      data-variant={variant}
      className={`character-sprite ${portrait || variant === 'avatar' ? 'is-portrait' : ''} ${variant === 'avatar' ? 'is-avatar' : ''} ${className}`}
      role="img"
      aria-label={
        variant === 'avatar'
          ? `Портрет: ${player?.name ?? (look.gender === 'female' ? 'Ратница' : 'Ратник')}`
          : `${look.gender === 'female' ? 'Ратница' : 'Ратник'}: ${armor?.name ?? 'льняная рубаха'}, ${weapon?.name ?? 'без оружия'}`
      }
    >
      <span className="character-art">
        {variant !== 'avatar' && weaponArt && sourceGrip && (
          <AtlasPart
            file={weaponArt.file ?? '/art/characters/equipment.webp'}
            box={weaponArt.box}
            position={anchoredPosition(weaponArt.box, sourceGrip, grip, weaponArt.scale)}
            size={[weaponArt.box[2] * weaponArt.scale, weaponArt.box[3] * weaponArt.scale]}
            rotate={weaponArt.rotate}
            className={`sprite-weapon ${weapon?.id === 'thunder-axe' ? 'is-thunder' : ''}`}
            testId="weapon-layer"
          />
        )}
        <AtlasPart
          file={ACCESSORIES_FILE}
          box={pantsBox}
          position={[114 - pantsBox[2] * 0.175, 154]}
          size={[pantsBox[2] * 0.35, 51]}
          className="character-legs"
          testId="legs-layer"
        />
        <AtlasPart
          file={feet ? ACCESSORIES_FILE : '/art/characters/outfits.webp'}
          box={feet ? bootsBox : starterBoots}
          position={[feet ? 114 - bootsBox[2] * 0.175 : 53, 200]}
          size={[feet ? bootsBox[2] * 0.35 : 122, 70]}
          className="character-feet"
          testId="feet-layer"
        />
        <AtlasPart
          file={headFile}
          box={headBox}
          position={headPosition}
          size={[headBox[2] * headScale, headBox[3] * headScale]}
          className="character-head"
          testId="head-layer"
        />
        <AtlasPart
          file={headFile}
          box={[headColumn.neckX, headRow.neckY - 59, 6, 6]}
          position={[108, 64]}
          size={[23, 16]}
          className="character-neck"
        />
        <AtlasPart
          file={outfitFile}
          box={outfit.box}
          position={bodyPosition}
          size={[outfit.box[2] * outfit.scale, outfit.box[3] * outfit.scale]}
          className="character-body"
          testId="armor-layer"
        />
        {helmetBox && (
          <AtlasPart
            file={ACCESSORIES_FILE}
            box={helmetBox}
            position={anchoredPosition(
              helmetBox,
              [helmetBox[0] + helmetBox[2] * 0.55, helmetBox[1] + helmetBox[3]],
              [HEAD_JOIN[0] - 2, HEAD_JOIN[1] - 8],
              0.2,
            )}
            size={[helmetBox[2] * 0.2, helmetBox[3] * 0.2]}
            className="character-helmet"
            testId="helmet-layer"
          />
        )}
        {variant !== 'avatar' && gloveArt && (
          <>
            <AtlasPart
              file={ACCESSORIES_FILE}
              box={gloveArt.main}
              position={anchoredPosition(
                gloveArt.main,
                [
                  gloveArt.main[0] + gloveArt.main[2] * 0.34,
                  gloveArt.main[1] + gloveArt.main[3] * 0.5,
                ],
                grip,
                0.19,
              )}
              size={[gloveArt.main[2] * 0.19, gloveArt.main[3] * 0.19]}
              className="character-gloves"
              testId="gloves-main-layer"
            />
            <AtlasPart
              file={ACCESSORIES_FILE}
              box={gloveArt.off}
              position={anchoredPosition(
                gloveArt.off,
                [gloveArt.off[0] + gloveArt.off[2] * 0.45, gloveArt.off[1] + gloveArt.off[3] * 0.6],
                offGrip,
                0.2,
              )}
              size={[gloveArt.off[2] * 0.2, gloveArt.off[3] * 0.2]}
              className="character-gloves"
              testId="gloves-off-layer"
            />
          </>
        )}
        {variant !== 'avatar' && offhandArt && (
          <AtlasPart
            file={ACCESSORIES_FILE}
            box={offhandArt.box}
            position={anchoredPosition(offhandArt.box, offhandArt.grip, offGrip, offhandArt.scale)}
            size={[offhandArt.box[2] * offhandArt.scale, offhandArt.box[3] * offhandArt.scale]}
            className="character-offhand"
            testId="offhand-layer"
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
        ? [512, 0, 608, 1024]
        : [1058, 0, 478, 1024];
  const scale = mobId === 'wolf' ? 0.32 : 0.267;
  const width = box[2] * scale;
  const height = box[3] * scale;
  return (
    <div
      className={`enemy-sprite ${className}`}
      data-mob={mobId}
      data-renderer="painted-atlas"
      data-facing="left"
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
