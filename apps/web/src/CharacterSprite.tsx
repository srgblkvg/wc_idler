import { useId } from 'react';
import {
  ITEM_BY_ID,
  DEFAULT_APPEARANCE,
  type Appearance,
  type ItemDefinition,
  type PublicPlayerState,
} from '@azeroth/game';
export { DEFAULT_APPEARANCE } from '@azeroth/game';
export type { Appearance } from '@azeroth/game';
type VisualItem = ItemDefinition & {
  armorStyle?: 'cloth' | 'leather' | 'chain';
  weaponStyle?: 'axe' | 'sword' | 'mace';
  accentColor?: string;
};
export function equippedItem(
  player: PublicPlayerState,
  slot: 'weapon' | 'armor' | 'trinket',
): VisualItem | null {
  const instance = player.inventory.find((i) => i.instanceId === player.equipment[slot]);
  return instance
    ? { ...ITEM_BY_ID[instance.itemId], ...ITEM_BY_ID[instance.itemId].visual }
    : null;
}
export function CharacterSprite({
  player,
  appearance = DEFAULT_APPEARANCE,
  className = '',
}: {
  player?: PublicPlayerState;
  appearance?: Appearance;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const look = player?.appearance || appearance;
  const female = look.gender === 'female';
  const armor = player ? equippedItem(player, 'armor') : null,
    weapon = player ? equippedItem(player, 'weapon') : null,
    trinket = player ? equippedItem(player, 'trinket') : null;
  const material = armor?.armorStyle || 'cloth',
    accent = armor?.accentColor || '#81714f',
    weaponStyle = weapon?.weaponStyle || 'none';
  const hair = { dark: '#31261e', fair: '#b19b62', red: '#8e4d2c' }[look.hair];
  return (
    <svg
      data-testid="character-avatar"
      data-gender={look.gender}
      data-armor={material}
      data-weapon={weaponStyle}
      className={`character-sprite ${className}`}
      viewBox="0 0 220 280"
      role="img"
      aria-label={`${female ? 'Ратница' : 'Ратник'}: ${material === 'chain' ? 'кольчуга' : material === 'leather' ? 'кожаный доспех' : 'льняная рубаха'}, ${weaponStyle === 'axe' ? 'топор' : weaponStyle === 'sword' ? 'меч' : weaponStyle === 'mace' ? 'булава' : 'без оружия'}`}
    >
      <defs>
        <clipPath id={`body-${id}`}>
          <rect x="35" y="0" width="153" height="280" />
        </clipPath>
        <pattern id={`chain-${id}`} patternUnits="userSpaceOnUse" width="4" height="3">
          <rect width="4" height="3" fill="#737b70" />
          <path d="M0 1Q1 3 2 1M2 0Q3 2 4 0" fill="none" stroke="#343f37" strokeWidth=".8" />
        </pattern>
        <linearGradient id={`steel-${id}`}>
          <stop stopColor="#566658" />
          <stop offset=".4" stopColor="#c3c3a9" />
          <stop offset="1" stopColor="#5b695a" />
        </linearGradient>
        <filter id={`skin-${id}`}>
          <feColorMatrix type="matrix" values=".84 0 0 0 0 0 .76 0 0 0 0 0 .69 0 0 0 0 0 1 0" />
        </filter>
      </defs>
      <ellipse cx="108" cy="271" rx="58" ry="7" fill="#030705" opacity=".45" />
      <image
        href="/art/slavic-heroes.png"
        x={female ? -174 : -27}
        y="0"
        width="420"
        height="280"
        preserveAspectRatio="none"
        clipPath={`url(#body-${id})`}
        filter={look.skin === 'tan' ? `url(#skin-${id})` : undefined}
      />
      <path
        d={
          female
            ? 'M97 19Q98 9 112 9Q132 11 137 23L134 27 125 15 108 15 101 26Z'
            : 'M95 17L102 6 123 4 135 15 131 18 122 10 105 14 98 22Z'
        }
        fill={hair}
        opacity=".83"
      />
      {look.hairStyle === 'braid' && (
        <>
          <path
            d={female ? 'M97 24Q88 42 98 67L97 88' : 'M131 18Q140 36 136 55L141 75'}
            stroke={hair}
            strokeWidth="7"
            fill="none"
          />
          <path
            d={
              female
                ? 'M97 30L92 36 99 43 94 50 101 58 95 65 99 73'
                : 'M135 28L141 34 135 41 141 48 136 56 141 63'
            }
            fill="none"
            stroke="#b79258"
            strokeWidth="1"
            opacity=".6"
          />
        </>
      )}
      {look.mark === 'scar' && (
        <path d={female ? 'M123 25L119 34' : 'M122 22L119 34'} stroke="#9a5843" strokeWidth="1.6" />
      )}
      {armor && (
        <g data-testid="armor-layer" key={armor.id}>
          {material === 'chain' ? (
            <>
              <path
                d={
                  female
                    ? 'M90 57L103 59 111 72 123 55 136 65 142 106 146 139Q112 148 78 139L85 97 81 71Z'
                    : 'M89 51L104 56 110 65 121 51 141 65 148 97 139 114 146 142 76 141 83 111 73 96 81 69Z'
                }
                fill={`url(#chain-${id})`}
                stroke="#434d41"
                strokeWidth="2"
              />
              <path
                d="M84 109L140 108 140 115 83 117Z"
                fill="#47352a"
                stroke="#ad8a50"
                strokeWidth="1.5"
              />
              <path
                d="M91 58L91 103M130 60L130 104"
                stroke="#bcc0a1"
                strokeWidth="1"
                opacity=".3"
              />
            </>
          ) : material === 'leather' ? (
            <>
              <path
                d={
                  female
                    ? 'M88 61L100 59 112 72 126 59 139 69 131 105 141 139 81 139 90 103 81 73Z'
                    : 'M88 57L101 57 109 70 123 54 139 64 136 109 142 140 78 140 85 109 81 67Z'
                }
                fill="#5b3e2b"
                stroke="#b28d58"
                strokeWidth="1.5"
              />
              <path
                d="M93 73L126 73 131 104 88 104Z"
                fill="#7c5236"
                stroke="#ba965c"
                strokeWidth="1"
              />
              <path
                d="M90 90L127 90M98 74L98 103M116 74L116 103"
                stroke="#5a3d28"
                strokeWidth="1.2"
              />
              <path d="M84 110L135 108" stroke="#362b22" strokeWidth="5" />
            </>
          ) : (
            <path
              d="M85 66L98 64 109 77 124 60 136 70 131 109 141 139 82 139 90 107Z"
              fill={accent}
              opacity=".3"
            />
          )}
          <rect
            x="106"
            y="108"
            width="9"
            height="7"
            fill="#9e8050"
            stroke="#4a3c28"
            strokeWidth="1.5"
          />
        </g>
      )}
      {trinket && (
        <g data-testid="trinket-layer">
          <path d="M101 51Q109 70 123 52" fill="none" stroke="#b79858" strokeWidth="1.3" />
          <path
            d="M109 64L115 68 114 75 108 78 104 72Z"
            fill={trinket.accentColor || '#b79858'}
            stroke="#6d572f"
            strokeWidth="1.4"
          />
        </g>
      )}
      {weapon && (
        <g className="sprite-weapon" data-testid="weapon-layer" transform="rotate(-13 168 150)">
          <path d="M172 68L170 204" stroke="#342a20" strokeWidth="5" strokeLinecap="round" />
          <path d="M171 71L169 201" stroke="#a47b4b" strokeWidth="1.6" />
          <path d="M171 137L171 160" stroke={weapon.accentColor} strokeWidth="6" />
          {weapon.rarity === 'epic' && (
            <path
              d="M173 72L179 86 171 89 184 101"
              fill="none"
              stroke={weapon.accentColor}
              strokeWidth="2.4"
            />
          )}
          {weaponStyle === 'axe' ? (
            <path
              d="M171 69L180 63Q201 78 192 102L174 94 167 96 165 72Z"
              fill={`url(#steel-${id})`}
              stroke="#3c4c3e"
              strokeWidth="2"
            />
          ) : weaponStyle === 'sword' ? (
            <>
              <path
                d="M168 130L167 25 174 10 179 26 175 130Z"
                fill={`url(#steel-${id})`}
                stroke="#344537"
                strokeWidth="1.5"
              />
              <path d="M158 132L183 132" stroke="#9e8250" strokeWidth="5" />
              <circle cx="171" cy="171" r="3.5" fill="#ae9055" />
            </>
          ) : (
            <>
              <path d="M171 69L170 53" stroke="#88907a" strokeWidth="6" />
              <path
                d="M158 64L153 51 159 38 166 41 170 30 178 41 187 39 192 55 183 68Z"
                fill={`url(#steel-${id})`}
                stroke="#3c4c3e"
                strokeWidth="2"
              />
            </>
          )}
        </g>
      )}
    </svg>
  );
}
export function EnemySprite({ mobId, className = '' }: { mobId: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={`enemy-sprite ${className}`}
      viewBox="0 0 220 280"
      role="img"
      aria-label={
        mobId === 'wolf' ? 'Лютый волк' : mobId === 'kobold' ? 'Леший' : 'Болотный налётчик'
      }
    >
      <defs>
        <clipPath id={`foe-${id}`}>
          <rect
            x={mobId === 'wolf' ? 15 : mobId === 'kobold' ? 25 : 20}
            y={mobId === 'wolf' ? 75 : 0}
            width={mobId === 'wolf' ? 160 : mobId === 'kobold' ? 140 : 180}
            height={mobId === 'wolf' ? 205 : 280}
          />
        </clipPath>
      </defs>
      <ellipse cx="110" cy="269" rx="76" ry="7" fill="#030705" opacity=".5" />
      <image
        href="/art/slavic-enemies.png"
        x={mobId === 'wolf' ? 0 : mobId === 'kobold' ? -128 : -284}
        y="0"
        width="420"
        height="280"
        preserveAspectRatio="none"
        clipPath={`url(#foe-${id})`}
      />
    </svg>
  );
}
