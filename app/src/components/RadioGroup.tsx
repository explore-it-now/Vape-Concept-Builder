import type { KeyboardEvent, ReactNode } from 'react';

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  className: string;
  /** Renders one option as a `role="radio"` button's props + children. */
  renderOption: (id: T, checked: boolean) => { className: string; children: ReactNode; title?: string; ariaLabel?: string };
}

/**
 * Buttons acting as a radio group: one tab stop, arrow keys move and select,
 * matching the WAI-ARIA radio group pattern.
 */
export function RadioGroup<T extends string>({ label, value, options, onChange, className, renderOption }: Props<T>) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = options.indexOf(value);
    const next = options[(i + step + options.length) % options.length];
    onChange(next);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons[options.indexOf(next)]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={onKeyDown}>
      {options.map((id) => {
        const checked = id === value;
        const o = renderOption(id, checked);
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            title={o.title}
            tabIndex={checked ? 0 : -1}
            className={o.className}
            onClick={() => onChange(id)}
          >
            {o.children}
          </button>
        );
      })}
    </div>
  );
}
