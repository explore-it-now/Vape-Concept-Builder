import type { RefObject } from 'react';
import type { SceneStatus } from '../scene/useScene';
import { Rotate } from './icons';

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: SceneStatus;
  engraving: string;
  caption: string;
  alt: string;
}

export function Preview({ canvasRef, status, engraving, caption, alt }: Props) {
  const stickerName = engraving.length > 12 ? engraving.slice(0, 12) + '…' : engraving;
  const stickerSize = Math.max(13, Math.min(22, Math.floor(150 / Math.max(engraving.length, 1))));

  return (
    <div className="preview">
      <canvas ref={canvasRef} className="preview__canvas" role="img" aria-label={alt} />
      <div className="preview__top mono-label">
        <span><span className="live-dot" />Live render</span>
        <span><Rotate />Drag to rotate</span>
      </div>
      {status !== 'ready' && (
        <div className="preview__loading mono-label">
          {status === 'failed' ? '3D preview unavailable in this browser' : 'Loading render'}
        </div>
      )}
      <div aria-hidden="true" className="preview__shade" />
      <div className="preview__caption">
        <div className="preview__caption-main">
          <span className="preview__brand">{engraving}</span>
          <span className="preview__meta">{caption}</span>
        </div>
        <span className="preview__note">Illustrative shapes, not to scale</span>
      </div>
      <div aria-hidden="true" className="spin-hint">
        <span>go on, give it a spin</span>
        <svg viewBox="0 0 120 70" width="96" height="56">
          <path d="M110 6 C 90 40, 60 58, 14 56" fill="none" stroke="#f2efe9" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M26 46 L 12 56 L 27 64" fill="none" stroke="#f2efe9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div aria-hidden="true" className="sticker">
        <span style={{ fontSize: stickerSize }}>
          made for<br />
          {stickerName}
        </span>
      </div>
    </div>
  );
}
