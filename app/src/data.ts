export type DeviceId = 'aio' | 'cart' | 'batt';
export type FinishId = 'black' | 'steel' | 'rose' | 'olive' | 'white';
export type PackId = 'kraft' | 'black' | 'window';
export type PlacementId = 'front' | 'back' | 'both';
export type MethodId = 'engraved' | 'printed' | 'embossed';

export interface Option<T extends string> {
  id: T;
  label: string;
}

export interface Device extends Option<DeviceId> {
  short: string;
  note: string;
}

export interface Finish extends Option<FinishId> {
  accent: string;
  smoke: [string, string];
  swatchBg: string;
}

export const DEVICES: Device[] = [
  { id: 'aio', label: 'All-in-one', short: 'All-in-one', note: 'Single unit' },
  { id: 'cart', label: '510 cartridge', short: '510 cart', note: 'Threaded tank' },
  { id: 'batt', label: 'Rechargeable battery', short: 'Battery', note: 'Rechargeable' },
];

export const FINISHES: Finish[] = [
  { id: 'black', label: 'Matte black', accent: '#ff7a45', smoke: ['#ff4d2e', '#5b2bff'], swatchBg: 'radial-gradient(circle at 35% 30%, #3a3a3d, #121214 70%)' },
  { id: 'steel', label: 'Brushed steel', accent: '#7cc8ff', smoke: ['#2f86ff', '#7fe6ff'], swatchBg: 'conic-gradient(from 30deg, #8e9398, #e7eaec, #9a9fa4, #d9dcdf, #8e9398)' },
  { id: 'rose', label: 'Rose gold', accent: '#ff9bb0', smoke: ['#ff5f8f', '#ffb070'], swatchBg: 'conic-gradient(from 30deg, #b77a66, #f6c9b7, #c48a74, #edb8a4, #b77a66)' },
  { id: 'olive', label: 'Deep olive', accent: '#bce46f', smoke: ['#8fd14f', '#1f9e84'], swatchBg: 'radial-gradient(circle at 35% 30%, #6c7a52, #353d25 70%)' },
  { id: 'white', label: 'Ceramic white', accent: '#cdbcff', smoke: ['#9f86ff', '#8fd3ff'], swatchBg: 'radial-gradient(circle at 35% 30%, #ffffff, #dcd6cb 75%)' },
];

export const PACKS: Option<PackId>[] = [
  { id: 'kraft', label: 'Kraft sleeve' },
  { id: 'black', label: 'Matte black box' },
  { id: 'window', label: 'Window box' },
];

export const PLACEMENTS: Option<PlacementId>[] = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'both', label: 'Front and back' },
];

export const METHODS: Option<MethodId>[] = [
  { id: 'engraved', label: 'Engraved' },
  { id: 'printed', label: 'Printed' },
  { id: 'embossed', label: 'Embossed' },
];

export const QUANTITIES = ['Under 1,000', '1,000–5,000', '5,000–20,000', '20,000+'] as const;

export const STEPS = [
  { n: '01', title: 'Play', note: 'the fun bit', body: 'Try every combination you like. Swap finishes, move your logo, drop in your own box artwork.' },
  { n: '02', title: 'Talk it through', note: 'a real person, not a bot', body: 'Your account manager checks the concept against what can actually be made, with minimums and lead times.' },
  { n: '03', title: 'Hold it', note: 'the best bit', body: 'A physical sample lands on your desk. Once it feels right in the hand, we go to production.' },
];

export const DEFAULT_BRAND = 'NORTHSTAR';
export const BRAND_MAX = 14;
export const SALES_EMAIL = 'sales@example.com';

export interface Concept {
  device: DeviceId;
  finish: FinishId;
  pack: PackId;
  brand: string;
  placement: PlacementId;
  method: MethodId;
  artwork: string | null;
  artworkName: string;
}

export interface SpecRow {
  label: string;
  value: string;
}

const find = <T extends { id: string }>(list: T[], id: string) => list.find((o) => o.id === id)!;

export const getDevice = (id: DeviceId) => find(DEVICES, id);
export const getFinish = (id: FinishId) => find(FINISHES, id);
export const getPack = (id: PackId) => find(PACKS, id);

export function engravingOf(brand: string) {
  return brand.trim() ? brand.trim().toUpperCase() : '—';
}

export function specRows(c: Concept): SpecRow[] {
  return [
    { label: 'Device', value: getDevice(c.device).label },
    { label: 'Finish', value: getFinish(c.finish).label },
    { label: 'Brand name', value: engravingOf(c.brand) },
    { label: 'Placement', value: find(PLACEMENTS, c.placement).label },
    { label: 'Method', value: find(METHODS, c.method).label },
    { label: 'Packaging', value: getPack(c.pack).label },
    { label: 'Box artwork', value: c.artwork ? 'Custom upload' : 'Standard layout' },
  ];
}

export function refCode(rows: SpecRow[]) {
  const str = rows.map((r) => r.value).join('|');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return 'CB-' + h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}
