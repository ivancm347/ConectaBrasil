export const MARKETS = {
  BR: {
    code: 'BR',
    path: 'br',
    legacyCountry: 'Brasil',
    countryName: 'Brasil',
    name: 'ConectaBrasil',
    language: 'pt-BR',
    currency: 'BRL',
    locale: 'pt-BR',
    enabled: true,
  },
  PY: {
    code: 'PY',
    path: 'py',
    legacyCountry: 'Paraguai',
    countryName: 'Paraguay',
    name: 'Conecta Paraguay',
    language: 'es',
    currency: 'PYG',
    locale: 'es-PY',
    enabled: false,
  },
};

function normalizeBasePath(baseUrl = '/') {
  const base = String(baseUrl || '/');
  return `/${base.split('/').filter(Boolean).join('/')}` + (base.split('/').filter(Boolean).length ? '/' : '');
}

/**
 * Resolves the market from the first path segment after Vite's base path.
 * The default remains Brazil to preserve the current production entry point.
 */
export function getMarketFromPath(pathname = window.location.pathname, baseUrl = import.meta.env.BASE_URL) {
  const base = normalizeBasePath(baseUrl);
  const path = String(pathname || '/');
  const relative = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\/+/, '');
  const segment = relative.split('/').filter(Boolean)[0]?.toLowerCase();

  if (segment === MARKETS.PY.path) return MARKETS.PY;
  return MARKETS.BR;
}

export function getMarketPath(marketCode, baseUrl = import.meta.env.BASE_URL) {
  const market = MARKETS[String(marketCode || 'BR').toUpperCase()] || MARKETS.BR;
  return `${normalizeBasePath(baseUrl)}${market.path}`;
}

/** Builds a browser-storage key isolated by the active market. */
export function getMarketStorageKey(key, marketCode = getMarketFromPath().code) {
  const code = String(marketCode || 'BR').toUpperCase();
  if (!MARKETS[code]) throw new Error('Mercado inválido para armazenamento local.');
  return `conecta:${code}:${String(key || '').replace(/^:+|:+$/g, '')}`;
}
