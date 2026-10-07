import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SKILL_BY_ID, type SkillId } from '@azeroth/game';
import './skill-controls.css';

function SkillGlyph({ id }: { id: SkillId }) {
  const [x, y, width, height] = {
    heavyStrike: [16, 150, 493, 714],
    ward: [517, 195, 493, 584],
    mend: [1060, 165, 465, 669],
  }[id];
  const size = Math.max(width, height);
  return (
    <span className="skill-art" data-skill-art={id} aria-hidden="true">
      <span
        style={{
          width: `${(width / size) * 100}%`,
          height: `${(height / size) * 100}%`,
          backgroundSize: `${(1536 / width) * 100}% ${(1024 / height) * 100}%`,
          backgroundPosition: `${(x / (1536 - width)) * 100}% ${(y / (1024 - height)) * 100}%`,
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
}: {
  id: SkillId;
  onClose: () => void;
  children?: ReactNode;
}) {
  const skill = SKILL_BY_ID[id];
  const title = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab' || !dialog.current) return;
      const buttons = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex="0"]',
        ),
      ];
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div className="skill-dialog-backdrop" onClick={onClose}>
      <div
        className="skill-dialog"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        onClick={(event) => event.stopPropagation()}
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
      </div>
    </div>,
    document.body,
  );
}
