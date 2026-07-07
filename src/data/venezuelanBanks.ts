export interface VenezuelanBank {
  code: string;
  name: string;
}

export const VENEZUELAN_BANKS: VenezuelanBank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0108', name: 'BBVA Provincial' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'DelSur Banco Universal' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Bicentenario' },
  { code: '0177', name: 'BANFANB' },
  { code: '0191', name: 'BNC Banco Nacional de Crédito' },
];

export function getBanksForMegasoft(supportedCodes: string[]): VenezuelanBank[] {
  if (supportedCodes.length === 0) return VENEZUELAN_BANKS;
  const set = new Set(supportedCodes);
  return VENEZUELAN_BANKS.filter((b) => set.has(b.code));
}
