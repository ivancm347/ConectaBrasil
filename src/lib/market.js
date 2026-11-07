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
    dialingCode: '55',
    postalCodeLabel: 'CEP',
    postalCodePattern: '^\\d{5}-?\\d{3}
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
    dialingCode: '595',
    postalCodeLabel: 'Código postal',
    postalCodePattern: '^\\d{6}
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
,
    regionLabel: 'Estado (UF)',
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
,
    regionLabel: 'Departamento',
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
,
    regionLabel: 'Estado (UF)',
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


/** Returns an international WhatsApp number using the selected market prefix. */
export function getInternationalPhoneNumber(phone, marketCode = 'BR') {
  const market = MARKETS[String(marketCode || 'BR').toUpperCase()];
  if (!market) throw new Error('Mercado inválido para telefone.');
  const digits = String(phone || '').replace(/\\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(market.dialingCode)) return digits;
  // Preserve an explicitly international number instead of prefixing it twice.
  if (digits.startsWith('55') || digits.startsWith('595')) return digits;
  return market.dialingCode + digits;
}

/** Formats monetary values according to the active market. */
export function formatMarketCurrency(value, marketCode = 'BR') {
  const market = MARKETS[String(marketCode || 'BR').toUpperCase()];
  if (!market) throw new Error('Mercado inválido para moeda.');
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
    maximumFractionDigits: market.currency === 'PYG' ? 0 : 2,
  }).format(Number(value) || 0);
}
