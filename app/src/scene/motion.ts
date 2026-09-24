export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** Phones and tablets: render lighter so the page stays smooth and cool. */
export const isTouchDevice = matchMedia('(hover: none) and (pointer: coarse)').matches;
