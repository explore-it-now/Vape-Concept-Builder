import type { ChangeEvent, ReactNode } from 'react';
import {
  BRAND_MAX, DEVICES, FINISHES, METHODS, PACKS, PLACEMENTS,
  getDevice, getFinish, getPack,
  type Concept, type Option,
} from '../data';
import { ArrowRight, Upload } from './icons';
import { RadioGroup } from './RadioGroup';

interface Props {
  concept: Concept;
  update: (patch: Partial<Concept>) => void;
  onSubmit: () => void;
}

const ids = <T extends string>(list: Option<T>[]) => list.map((o) => o.id);
const labelOf = <T extends string>(list: Option<T>[], id: T) => list.find((o) => o.id === id)!.label;

function FieldHead({ n, title, htmlFor, children }: { n: string; title: string; htmlFor?: string; children?: ReactNode }) {
  return (
    <div className="field__head">
      <span className="field__num accent-text">{n}</span>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="field__title">{title}</label>
      ) : (
        <span className="field__title">{title}</span>
      )}
      {children}
    </div>
  );
}

export function ConfigPanel({ concept: c, update, onSubmit }: Props) {
  const onArtwork = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !/^image\//.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => update({ artwork: reader.result as string, artworkName: file.name });
    reader.readAsDataURL(file);
  };

  return (
    <div className="panel">
      <div className="field">
        <FieldHead n="01" title="Device">
          <span className="field__value">{getDevice(c.device).label}</span>
        </FieldHead>
        <RadioGroup
          label="Device"
          className="devices"
          value={c.device}
          options={DEVICES.map((d) => d.id)}
          onChange={(device) => update({ device })}
          renderOption={(id) => {
            const d = getDevice(id);
            return {
              className: 'device-btn',
              children: (
                <>
                  <span className="device-btn__name">{d.short}</span>
                  <span className="device-btn__note">{d.note}</span>
                </>
              ),
            };
          }}
        />
      </div>

      <div className="field">
        <FieldHead n="02" title="Finish">
          <span className="field__value">{getFinish(c.finish).label}</span>
        </FieldHead>
        <RadioGroup
          label="Finish"
          className="swatches"
          value={c.finish}
          options={FINISHES.map((f) => f.id)}
          onChange={(finish) => update({ finish })}
          renderOption={(id) => {
            const f = getFinish(id);
            return { className: 'swatch', ariaLabel: f.label, title: f.label, children: <span style={{ background: f.swatchBg }} /> };
          }}
        />
      </div>

      <div className="field">
        <FieldHead n="03" title="Brand name" htmlFor="cb-brand">
          <span className="field__count">{c.brand.length}/{BRAND_MAX}</span>
        </FieldHead>
        <input
          id="cb-brand"
          className="brand-input"
          type="text"
          maxLength={BRAND_MAX}
          autoComplete="off"
          spellCheck={false}
          value={c.brand}
          onChange={(e) => update({ brand: e.target.value.slice(0, BRAND_MAX) })}
          placeholder="Your brand"
          aria-describedby="cb-brand-hint"
        />
        <span id="cb-brand-hint" className="hint">Runs along the side of the device. Up to {BRAND_MAX} characters.</span>
        <div className="subopts">
          <span className="subopts__label">Placement</span>
          <RadioGroup
            label="Placement"
            className="pills"
            value={c.placement}
            options={ids(PLACEMENTS)}
            onChange={(placement) => update({ placement })}
            renderOption={(id) => ({ className: 'pill', children: labelOf(PLACEMENTS, id) })}
          />
          <span className="subopts__label">Method</span>
          <RadioGroup
            label="Method"
            className="pills"
            value={c.method}
            options={ids(METHODS)}
            onChange={(method) => update({ method })}
            renderOption={(id) => ({ className: 'pill', children: labelOf(METHODS, id) })}
          />
        </div>
      </div>

      <div className="field">
        <FieldHead n="04" title="Packaging">
          <span className="field__value">{getPack(c.pack).label}</span>
        </FieldHead>
        <RadioGroup
          label="Packaging"
          className="pills pills--pack"
          value={c.pack}
          options={ids(PACKS)}
          onChange={(pack) => update({ pack })}
          renderOption={(id) => ({ className: 'pill pill--lg', children: labelOf(PACKS, id) })}
        />
        <input
          id="cb-art"
          className="visually-hidden-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onArtwork}
        />
        {c.artwork ? (
          <div className="artwork">
            <span role="img" aria-label="Uploaded box artwork" className="artwork__thumb" style={{ backgroundImage: `url("${c.artwork}")` }} />
            <span className="artwork__name">{c.artworkName}</span>
            <label htmlFor="cb-art" className="ghost-btn" style={{ padding: '8px 10px' }}>Replace</label>
            <button type="button" className="ghost-btn" onClick={() => update({ artwork: null, artworkName: '' })}>Remove</button>
          </div>
        ) : (
          <label htmlFor="cb-art" className="upload">
            <Upload />
            <span className="upload__text">
              <span className="upload__title">Upload box artwork</span>
              <span className="upload__sub">PNG, JPG or WebP. Covers the front of the box.</span>
            </span>
          </label>
        )}
      </div>

      <div className="panel__submit">
        <button type="button" className="btn-primary btn-primary--block" onClick={onSubmit}>
          Submit concept
          <ArrowRight />
        </button>
        <span className="panel__submit-note">Your account manager replies with options, minimums and lead times.</span>
      </div>
    </div>
  );
}
