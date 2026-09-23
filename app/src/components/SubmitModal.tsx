import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { QUANTITIES } from '../data';
import { ArrowRight, Check, Close } from './icons';
import { RadioGroup } from './RadioGroup';

type Qty = (typeof QUANTITIES)[number];

interface Props {
  open: boolean;
  onClose: () => void;
  chips: string[];
  refCode: string;
  onSheet: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Demo enquiry form. Stays mounted while closed so the customer's details
 * survive closing and reopening. Nothing is sent anywhere.
 */
export function SubmitModal({ open, onClose, chips, refCode, onSheet }: Props) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [qty, setQty] = useState<Qty>('1,000–5,000');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<'' | 'name' | 'email'>('');
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);

  // Reopening after a send starts a fresh form view (details are kept).
  const close = useCallback(() => {
    setSubmitted(false);
    setError('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => firstField.current?.focus(), 30);
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('name');
    if (!EMAIL_RE.test(email.trim())) return setError('email');
    setError('');
    setSubmitted(true);
  };

  // Keep Tab focus inside the dialog.
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const els = dialogRef.current.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), input, textarea, [href]');
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const firstName = name.trim().split(' ')[0];

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cb-submit-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className="modal__head">
          <div className="modal__titles">
            <span className="modal__kicker mono-label">{submitted ? `Ref ${refCode}` : 'Submit concept'}</span>
            <h2 id="cb-submit-title">{submitted ? 'Concept received.' : 'Send it to our team.'}</h2>
          </div>
          <button type="button" aria-label="Close" className="modal__close" onClick={close}>
            <Close />
          </button>
        </div>

        <div className="chips">
          {chips.map((c, i) => <span key={i} className="chip">{c}</span>)}
        </div>

        {!submitted ? (
          <form className="form" onSubmit={submit} noValidate>
            <div className="form__row">
              <label className="form__label">
                Your name
                <input
                  ref={firstField}
                  className="input"
                  type="text"
                  autoComplete="name"
                  value={name}
                  aria-invalid={error === 'name'}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                />
              </label>
              <label className="form__label">
                Company
                <input className="input" type="text" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
            </div>
            <label className="form__label">
              Work email
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                aria-invalid={error === 'email'}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
              />
            </label>
            <div className="form__group">
              <span className="form__label">Estimated quantity</span>
              <RadioGroup
                label="Estimated quantity"
                className="pills"
                value={qty}
                options={QUANTITIES}
                onChange={setQty}
                renderOption={(q) => ({ className: 'pill pill--md', children: q })}
              />
            </div>
            <label className="form__label">
              Anything else (optional)
              <textarea
                className="input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Target launch date, markets, questions"
              />
            </label>
            {error && (
              <span role="alert" className="form__error">
                {error === 'name' ? 'Please add your name.' : 'Please enter a valid email address.'}
              </span>
            )}
            <button type="submit" className="btn-primary form__submit">
              Send concept
              <ArrowRight />
            </button>
            <span className="demo-note">Demo only. Nothing is sent or stored.</span>
          </form>
        ) : (
          <div className="thanks">
            <div className="thanks__card">
              <span className="thanks__icon"><Check /></span>
              <span className="thanks__text" role="status">
                Thanks{firstName ? `, ${firstName}` : ''}. In a live version, an account manager would reply to {email.trim() || 'you'} about this concept.
              </span>
            </div>
            <div className="thanks__actions">
              <button type="button" className="btn-outline" onClick={onSheet}>Download spec sheet</button>
              <button type="button" className="btn-light" onClick={close}>Back to builder</button>
            </div>
            <span className="demo-note">Demo only. Nothing was sent or stored.</span>
          </div>
        )}
      </div>
    </div>
  );
}
