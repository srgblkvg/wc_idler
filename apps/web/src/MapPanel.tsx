import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { MOB_BY_ID, type MobId } from '@azeroth/game';
import { EnemySprite } from './CharacterSprite';
import { Money } from './Common';
import type { GameProps } from './GamePanels';
import './map-panel.css';

type Destination = MobId | 'camp';
const PLACES: { id: Destination; label: string; x: number; y: number }[] = [
  { id: 'camp', label: 'Брод', x: 29, y: 78 },
  { id: 'wolf', label: 'Опушка', x: 25, y: 34 },
  { id: 'kobold', label: 'Старый бор', x: 64, y: 20 },
  { id: 'defias', label: 'Топи', x: 79, y: 55 },
];

function DestinationDetails({
  id,
  player,
  pending,
  act,
  onClose,
  onTravel,
}: GameProps & { id: Destination; onClose: () => void; onTravel?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mob = id === 'camp' ? null : MOB_BY_ID[id];
  const locked = !!mob && player.level < mob.level;
  const title = mob?.location ?? 'Берёзовый Брод';
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);
  const travel = async () => {
    const success = await act(id === 'camp' ? { type: 'rest' } : { type: 'startHunt', mobId: id });
    if (success) {
      onClose();
      onTravel?.();
    }
  };
  return (
    <dialog
      ref={dialog}
      className="map-destination-dialog"
      data-testid="map-destination"
      aria-labelledby="map-destination-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <button
        type="button"
        className="map-detail-close"
        aria-label="Закрыть место"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <div className={`map-destination-art map-destination-${id}`}>
        {mob ? (
          <EnemySprite mobId={mob.id} />
        ) : (
          <img src="/art/birchford-map.webp" alt="Деревня у деревянного моста" />
        )}
      </div>
      <h2 id="map-destination-title">{title}</h2>
      {mob ? (
        <>
          <p className="map-destination-enemy">
            {mob.name}
            <span>ур. {mob.level}</span>
          </p>
          <div className="map-destination-rewards">
            <span>{mob.xp} опыта</span>
            <Money copper={mob.copper} />
          </div>
        </>
      ) : (
        <p className="map-camp-copy">Костёр восстанавливает здоровье и силу.</p>
      )}
      <button
        className="button primary map-travel-button"
        data-testid={`travel-${id}`}
        disabled={pending || locked || (id === 'camp' && player.mode === 'resting')}
        onClick={() => void travel()}
      >
        {locked
          ? `Нужен ${mob!.level} уровень`
          : id === 'camp'
            ? player.mode === 'resting'
              ? 'Отдыхаете'
              : 'К костру'
            : 'В бой'}
      </button>
    </dialog>
  );
}

export function RegionPanel({
  player,
  pending,
  act,
  onTravel,
}: GameProps & { onTravel?: () => void }) {
  const [selected, setSelected] = useState<Destination | null>(null);
  const current = player.mode === 'hunting' ? player.targetMobId : 'camp';
  return (
    <section className="painted-map-panel" aria-label="Карта Берёзового Брода">
      <header className="painted-map-heading">
        <h2>Берёзовый Брод</h2>
      </header>
      <div className="painted-map-viewport">
        <div className="painted-map-canvas" data-testid="region-map">
          <img
            className="painted-map-image"
            src="/art/birchford-map.webp"
            alt="Тропы от Берёзового Брода к опушке, старому бору и камышовым топям"
            draggable={false}
          />
          {PLACES.map((place) => {
            const mob = place.id === 'camp' ? null : MOB_BY_ID[place.id];
            const locked = !!mob && player.level < mob.level;
            return (
              <button
                key={place.id}
                type="button"
                data-testid={`map-place-${place.id}`}
                className={`map-place map-place-${place.id} ${current === place.id ? 'current' : ''} ${locked ? 'locked' : ''}`}
                style={{ '--place-x': `${place.x}%`, '--place-y': `${place.y}%` } as CSSProperties}
                aria-label={`${mob?.location ?? 'Берёзовый Брод'}${mob ? `, уровень ${mob.level}` : ', отдых'}`}
                aria-haspopup="dialog"
                aria-current={current === place.id ? 'location' : undefined}
                onClick={() => setSelected(place.id)}
              >
                <span className="map-place-marker" aria-hidden="true">
                  {mob ? mob.level : <i />}
                </span>
                <span className="map-place-label">{place.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <DestinationDetails
          id={selected}
          player={player}
          pending={pending}
          act={act}
          onClose={() => setSelected(null)}
          onTravel={onTravel}
        />
      )}
    </section>
  );
}
