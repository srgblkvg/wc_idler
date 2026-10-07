import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from './UiIcons';
import { SKILL_BY_ID, type SkillId } from '@azeroth/game';
import './skill-controls.css';

type SkillFrame = {
  source: string;
  atlas: readonly [number, number];
  bounds: readonly [number, number, number, number];
};
const SKILL_ART: Record<SkillId, SkillFrame> = {
  heavyStrike: {
    source: '/art/skills-atlas.webp',
    atlas: [1536, 1024],
    bounds: [29, 121, 523, 755],
  },
  ward: {
    source: '/art/skills-atlas.webp',
    atlas: [1536, 1024],
    bounds: [510, 150, 503, 625],
  },
  mend: {
    source: '/art/skills-atlas.webp',
    atlas: [1536, 1024],
    bounds: [1064, 158, 452, 670],
  },
  flurry: {
    source: '/art/skills-extra.webp',
    atlas: [1774, 887],
    bounds: [55, 77, 777, 727],
  },
  secondWind: {
    source: '/art/skills-extra.webp',
    atlas: [1774, 887],
    bounds: [908, 48, 838, 802],
  },
};

function SkillGlyph({ id }: { id: SkillId }) {
  const {
    source,
    atlas: [atlasWidth, atlasHeight],
    bounds: [x, y, width, height],
  } = SKILL_ART[id];
  const size = Math.max(width, height);
  return (
    <span className="skill-art" data-skill-art={id} aria-hidden="true">
      <span
        style={{
          width: `${(width / size) * 100}%`,
          height: `${(height / size) * 100}%`,
          backgroundImage: `url("${source}")`,
          backgroundSize: `${(atlasWidth / width) * 100}% ${(atlasHeight / height) * 100}%`,
          backgroundPosition: `${atlasWidth === width ? 0 : (x / (atlasWidth - width)) * 100}% ${atlasHeight === height ? 0 : (y / (atlasHeight - height)) * 100}%`,
        }}
      />
    </span>
  );
}

export function SkillButton({
  id,
  cooldown = 0,
  active = false,
  onClick,
}: {
  id: SkillId;
  cooldown?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const tooltip = useId();
  const skill = SKILL_BY_ID[id];
  return (
    <button
      type="button"
      className={`skill-pill skill-icon skill-${id} ${active ? 'used' : ''}`}
      aria-label={skill.name}
      aria-describedby={tooltip}
      aria-haspopup={onClick ? 'dialog' : undefined}
      onClick={onClick}
      data-cooldown={cooldown}
    >
      <SkillGlyph id={id} />
      {cooldown > 0 ? (
        <span className="skill-cooldown" aria-label={`Готов через ${cooldown} ход.`}>
          {cooldown}
        </span>
      ) : (
        <i className="skill-ready" aria-label="Готов" />
      )}
      <span role="tooltip" className="skill-tooltip" id={tooltip}>
        <strong>{skill.name}</strong>
        {skill.description}
      </span>
    </button>
  );
}

export function SkillDetails({
  id,
  onClose,
  children,
  source,
}: {
  id: SkillId;
  onClose: () => void;
  children?: ReactNode;
  source?: string;
}) {
  const skill = SKILL_BY_ID[id];
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      className="skill-dialog"
      ref={dialog}
      aria-labelledby={title}
      data-testid="skill-detail"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], [tabindex="0"]',
          ),
        ];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className="skill-dialog-close"
        onClick={onClose}
        aria-label="Закрыть описание"
      >
        <X size={20} />
      </button>
      <div className={`skill-detail-icon skill-${id}`}>
        <SkillGlyph id={id} />
      </div>
      <h2 id={title}>{skill.name}</h2>
      <p>{skill.description}</p>
      {source && <p className="skill-detail-source">{source}</p>}
      <dl>
        <div>
          <dt>Сила</dt>
          <dd>{skill.manaCost}</dd>
        </div>
        <div>
          <dt>Перезарядка</dt>
          <dd>{skill.cooldownTurns} хода</dd>
        </div>
      </dl>
      {children && <div className="skill-dialog-action">{children}</div>}
    </dialog>,
    document.body,
  );
}
