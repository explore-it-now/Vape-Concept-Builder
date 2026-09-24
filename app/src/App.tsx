import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  DEFAULT_BRAND, engravingOf, getDevice, getFinish, getPack, refCode, specRows,
  type Concept,
} from './data';
import { printSpecSheet } from './lib/specSheet';
import { useScene } from './scene/useScene';
import { ConfigPanel } from './components/ConfigPanel';
import { Preview } from './components/Preview';
import { SpecBar } from './components/SpecBar';
import { Contact, Footer, Hero, Nav, Process } from './components/Sections';
import { SubmitModal } from './components/SubmitModal';

const INITIAL: Concept = {
  device: 'aio',
  finish: 'black',
  pack: 'kraft',
  brand: DEFAULT_BRAND,
  placement: 'front',
  method: 'engraved',
  artwork: null,
  artworkName: '',
};

export default function App() {
  const [concept, setConcept] = useState<Concept>(INITIAL);
  const [submitOpen, setSubmitOpen] = useState(false);
  const update = useCallback((patch: Partial<Concept>) => setConcept((c) => ({ ...c, ...patch })), []);

  const smokeRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLCanvasElement>(null);

  const device = getDevice(concept.device);
  const finish = getFinish(concept.finish);
  const pack = getPack(concept.pack);
  const engraving = engravingOf(concept.brand);
  const rows = useMemo(() => specRows(concept), [concept]);
  const ref = refCode(rows);

  const { status, snapshot } = useScene(smokeRef, stageRef, {
    device: concept.device,
    finish: concept.finish,
    engraving,
    pack: concept.pack,
    accent: finish.accent,
    smoke: finish.smoke,
    placement: concept.placement,
    method: concept.method,
    artwork: concept.artwork,
  });

  const openSubmit = useCallback(() => setSubmitOpen(true), []);
  const closeSubmit = useCallback(() => setSubmitOpen(false), []);
  const onSheet = () => printSpecSheet({ title: engraving, ref, rows, accent: finish.accent, image: snapshot() });

  return (
    <div className="page" style={{ '--accent': finish.accent } as CSSProperties}>
      <canvas ref={smokeRef} className="smoke" aria-hidden="true" />
      <div aria-hidden="true" className="smoke-fade" />

      <Nav onSubmit={openSubmit} />

      <main>
        <section id="builder" className="wrap builder">
          {/* Desktop: two columns (hero + options | preview + summary).
              Mobile: one column, with the preview pinned above the options while they scroll. */}
          <div className="builder__grid">
            <Hero />

            <div className="configurator">
              <Preview
                canvasRef={stageRef}
                status={status}
                engraving={engraving}
                caption={`${device.label} · ${finish.label} · ${pack.label}`}
                alt={`3D render: ${device.label} in ${finish.label}, ${concept.method} ${engraving}, with ${pack.label}`}
              />
              <ConfigPanel concept={concept} update={update} onSubmit={openSubmit} />
            </div>

            <div className="builder__summary">
              <SpecBar rows={rows} onSheet={onSheet} />
              <p className="fineprint">Turnaround times are illustrative until confirmed by your account manager.</p>
            </div>
          </div>
        </section>

        <Process />
        <Contact onSubmit={openSubmit} />
      </main>

      <Footer />

      <SubmitModal
        open={submitOpen}
        onClose={closeSubmit}
        chips={rows.map((r) => r.value)}
        refCode={ref}
        onSheet={onSheet}
      />
    </div>
  );
}
