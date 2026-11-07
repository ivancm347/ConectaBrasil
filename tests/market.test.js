import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARKETS,
  getMarketFromPath,
  getMarketPath,
  getMarketStorageKey,
} from '../src/lib/market.js';

test('Brasil continua sendo o mercado padrão e habilitado', () => {
  assert.equal(MARKETS.BR.enabled, true);
  assert.equal(getMarketFromPath('/ConectaBrasil/', '/ConectaBrasil/').code, 'BR');
  assert.equal(getMarketFromPath('/ConectaBrasil/br', '/ConectaBrasil/').code, 'BR');
});

test('Paraguai é reconhecido pela rota, mas permanece desabilitado', () => {
  assert.equal(getMarketFromPath('/ConectaBrasil/py', '/ConectaBrasil/').code, 'PY');
  assert.equal(MARKETS.PY.enabled, false);
});

test('rotas respeitam o base path do GitHub Pages', () => {
  assert.equal(getMarketPath('BR', '/ConectaBrasil/'), '/ConectaBrasil/br');
  assert.equal(getMarketPath('PY', '/ConectaBrasil/'), '/ConectaBrasil/py');
});

test('chaves locais ficam separadas por mercado', () => {
  assert.equal(getMarketStorageKey('favorites', 'BR'), 'conecta:BR:favorites');
  assert.equal(getMarketStorageKey('favorites', 'PY'), 'conecta:PY:favorites');
  assert.throws(() => getMarketStorageKey('favorites', 'AR'), /Mercado inválido/);
});


test('telefone usa o código internacional do mercado sem duplicá-lo', async () => {
  const { getInternationalPhoneNumber } = await import('../src/lib/market.js');
  assert.equal(getInternationalPhoneNumber('(11) 97698-3978', 'BR'), '5511976983978');
  assert.equal(getInternationalPhoneNumber('981 123 456', 'PY'), '595981123456');
  assert.equal(getInternationalPhoneNumber('+595 981 123 456', 'PY'), '595981123456');
  assert.equal(getInternationalPhoneNumber('', 'PY'), '');
});

test('moeda segue a configuração de cada mercado', async () => {
  const { formatMarketCurrency } = await import('../src/lib/market.js');
  assert.match(formatMarketCurrency(100, 'BR'), /R\$/);
  assert.match(formatMarketCurrency(100, 'PY'), /Gs/);
});
