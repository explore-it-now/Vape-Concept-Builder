import { useEffect, useRef, useState } from 'react';
import type { SpecRow } from '../data';
import { copyText } from '../lib/clipboard';
import { canPrint } from '../lib/specSheet';
import { Copy, FileDown } from './icons';

interface Props {
  rows: SpecRow[];
  onSheet: () => void;
}

export function SpecBar({ rows, onSheet }: Props) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const timer = useRef<number>(undefined);
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const summary = rows.map((r) => `${r.label}: ${r.value}`).join('\n');

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (manual) {
      manualRef.current?.focus();
      manualRef.current?.select();
    }
  }, [manual]);

  const onCopy = async () => {
    clearTimeout(timer.current);
    if (await copyText(summary)) {
      setManual(false);
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } else {
      setCopied(false);
      setManual(true);
    }
  };

  return (
    <>
      <div className="spec">
        {rows.map((r) => (
          <div key={r.label} className="spec__cell">
            <span className="spec__label">{r.label}</span>
            <span className="spec__value">{r.value}</span>
          </div>
        ))}
        <div className="spec__actions">
          <span role="status" className="copied" style={{ opacity: copied ? 1 : 0 }}>{copied ? 'Copied' : ''}</span>
          {canPrint && (
            <button type="button" className="btn-outline" onClick={onSheet}>
              <FileDown />
              Spec sheet (PDF)
            </button>
          )}
          <button type="button" className="btn-outline" onClick={onCopy}>
            <Copy />
            Copy summary
          </button>
        </div>
      </div>
      {manual && (
        <div className="manual">
          <label htmlFor="cb-manual">Clipboard access is blocked here. Select and copy this text:</label>
          <textarea id="cb-manual" ref={manualRef} readOnly rows={4} value={summary} />
        </div>
      )}
    </>
  );
}
