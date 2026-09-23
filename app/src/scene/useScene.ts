import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Smoke } from './smoke';
import type { Stage, StageInput } from './stage';

export type SceneStatus = 'loading' | 'ready' | 'failed';

/**
 * Lazily loads three.js, mounts the smoke background and the 3D stage onto the
 * given canvases, and pushes every change of `input` through to them.
 */
export function useScene(
  smokeCanvas: RefObject<HTMLCanvasElement | null>,
  stageCanvas: RefObject<HTMLCanvasElement | null>,
  input: StageInput,
) {
  const [status, setStatus] = useState<SceneStatus>('loading');
  const smoke = useRef<Smoke | null>(null);
  const stage = useRef<Stage | null>(null);
  const latest = useRef(input);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import('./smoke'), import('./stage')])
      .then(([smokeMod, stageMod]) => {
        if (cancelled || !smokeCanvas.current || !stageCanvas.current) return;
        try {
          smoke.current = smokeMod.createSmoke(smokeCanvas.current);
          stage.current = stageMod.createStage(stageCanvas.current);
          smoke.current.setColors(...latest.current.smoke);
          stage.current.update(latest.current);
          setStatus('ready');
        } catch (e) {
          console.error(e);
          setStatus('failed');
        }
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setStatus('failed');
      });
    return () => {
      cancelled = true;
      smoke.current?.dispose();
      stage.current?.dispose();
      smoke.current = stage.current = null;
    };
  }, [smokeCanvas, stageCanvas]);

  const [c1, c2] = input.smoke;
  useEffect(() => {
    smoke.current?.setColors(c1, c2);
  }, [c1, c2]);

  useEffect(() => {
    latest.current = input;
    stage.current?.update(input);
  });

  return { status, snapshot: () => stage.current?.snapshot() ?? '' };
}
