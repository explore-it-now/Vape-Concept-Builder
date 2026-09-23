const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  viewBox: '0 0 24 24',
};

export const ArrowRight = () => (
  <svg width="18" height="18" strokeWidth="2.25" {...base}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

export const Upload = () => (
  <svg width="18" height="18" strokeWidth="2" {...base}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </svg>
);

export const Rotate = () => (
  <svg width="14" height="14" strokeWidth="2" {...base}>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const FileDown = () => (
  <svg width="16" height="16" strokeWidth="2.25" {...base}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M12 18v-6" />
    <path d="M9 15l3 3 3-3" />
  </svg>
);

export const Copy = () => (
  <svg width="16" height="16" strokeWidth="2.25" {...base}>
    <rect width="14" height="14" x="8" y="8" rx="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

export const Close = () => (
  <svg width="16" height="16" strokeWidth="2.25" {...base}>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

export const Check = () => (
  <svg width="20" height="20" strokeWidth="2.5" {...base}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
