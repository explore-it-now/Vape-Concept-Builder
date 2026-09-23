import { SALES_EMAIL, STEPS } from '../data';
import { ArrowRight } from './icons';

export function Nav({ onSubmit }: { onSubmit: () => void }) {
  return (
    <nav className="nav">
      <div className="wrap nav__inner">
        <a href="#builder" className="logo">
          <span className="logo__mark" />
          <span className="wordmark">Concept<em> builder</em></span>
        </a>
        <div className="nav__links">
          <a href="#builder">Builder</a>
          <a href="#process">Process</a>
        </div>
        <button type="button" className="nav__cta" onClick={onSubmit}>Submit concept</button>
      </div>
    </nav>
  );
}

export function Hero() {
  return (
    <header className="hero">
      <div className="eyebrow mono-label">
        <span className="eyebrow__dot" />
        <span>Custom hardware configurator</span>
      </div>
      <h1>
        Design your device. <em className="serif-hi">See it in 3D.</em>
        <svg aria-hidden="true" className="scribble" viewBox="0 0 300 24" preserveAspectRatio="none">
          <path d="M4 16 C 60 6, 120 20, 180 10 S 270 8, 296 12" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
          <path d="M30 21 C 110 14, 200 20, 262 16" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        </svg>
      </h1>
      <p>Start with a device, dress it in a finish, put your name on it and pick the box it ships in. Play around. Nothing's final until you hit submit.</p>
    </header>
  );
}

export function Process() {
  return (
    <section id="process" className="wrap process">
      <div className="process__inner">
        <h2>From first concept to <em className="serif-hi">production run.</em></h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step">
              <span className="step__n accent-text">{s.n}</span>
              <h3>{s.title}</h3>
              <span className="step__note">{s.note}</span>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Contact({ onSubmit }: { onSubmit: () => void }) {
  return (
    <section id="contact" className="wrap contact">
      <div className="contact__card">
        <div className="contact__copy">
          <h2>Ready to make it <em className="serif-hi">real?</em></h2>
          <p>Submit your concept and an account manager will confirm what's possible for your order size and timeline.</p>
        </div>
        <div className="contact__actions">
          <a href={`mailto:${SALES_EMAIL}`} className="btn-link">Email sales</a>
          <button type="button" className="btn-primary" onClick={onSubmit}>
            Submit concept
            <ArrowRight />
          </button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <span className="wordmark">Concept<em> builder</em></span>
        <p>This is a demonstration. It isn't connected to real stock, pricing or production data, and the device shapes are illustrative rather than exact models of any manufacturer's hardware.</p>
      </div>
    </footer>
  );
}
