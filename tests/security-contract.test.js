import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MARKETS } from '../src/lib/market.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const imageMigration = read('../supabase/migrations/20261106150000_secure_business_image_storage_policies.sql');
const bucketSetup = read('../supabase/business_images.sql');
const imageAccess = imageMigration;
const countryMigration = read('../supabase/migrations/20261106090000_add_business_country_code.sql');
const reviewMigration = read('../supabase/migrations/20261106160000_scope_business_reviews_by_market.sql');

function policyBlock(policyName) {
  const escaped = policyName;
  const match = imageMigration.match(new RegExp('create policy "' + escaped + '"[\s\S]*?;','i'));
  assert.ok(match, `Política ausente: ${policyName}`);
  return match[0];
}

test('Paraguai continua bloqueado até a aprovação dos testes de isolamento', () => {
  assert.equal(MARKETS.PY.enabled, false);
});

test('bucket business-images é configurado como privado', () => {
  assert.match(bucketSetup, /values\s*\(\s*'business-images'\s*,\s*'business-images'\s*,\s*false/i);
});

test('upload exige UID da pasta e anúncio pertencente ao usuário', () => {
  const sql = policyBlock('Owners upload business images');
  assert.match(sql, /storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i);
  assert.match(sql, /exists\s*\([\s\S]*?from\s+public\.businesses(?:\s+as)?\s+b[\s\S]*?b\.id::text\s*=\s*\(storage\.foldername\(name\)\)\[2\][\s\S]*?b\.owner_id\s*=\s*auth\.uid\(\)/i);
});

test('alteração exige propriedade tanto no objeto atual quanto no destino', () => {
  const sql = policyBlock('Owners update business images');
  assert.match(sql, /using\s*\([\s\S]*?b\.owner_id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /with\s+check\s*\([\s\S]*?b\.owner_id\s*=\s*auth\.uid\(\)/i);
});

test('exclusão exige propriedade do anúncio associado', () => {
  const sql = policyBlock('Owners delete business images');
  assert.match(sql, /using\s*\([\s\S]*?b\.id::text\s*=\s*\(storage\.foldername\(name\)\)\[2\][\s\S]*?b\.owner_id\s*=\s*auth\.uid\(\)/i);
});

test('operações de imagem do proprietário respeitam o mercado confiável da sessão', () => {
  for (const name of ['Owners upload business images', 'Owners update business images', 'Owners delete business images']) {
    const sql = policyBlock(name);
    assert.match(sql, /b\.country_code\s*=\s*\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'market_code'\)/i);
  }
});

test('leitura de imagens continua mediada por can_view_business_image', () => {
  assert.match(imageAccess, /security\s+definer/i);
  assert.match(imageAccess, /set\s+search_path\s*=\s*''/i);
  assert.match(imageAccess, /b\.status\s*=\s*'approved'/i);
  assert.match(imageAccess, /b\.owner_id::text\s*=\s*\(storage\.foldername\(object_name\)\)\[1\]/i);
  assert.match(imageAccess, /b\.owner_id\s*=\s*auth\.uid\(\)/i);
  assert.match(
    imageAccess,
    /or\s*\(\s*b\.owner_id\s*=\s*auth\.uid\(\)\s*and\s*b\.country_code\s*=\s*\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'market_code'\)\s*\)/i,
    'Leitura privada pelo proprietário deve exigir o mercado confiável da sessão',
  );
  assert.match(imageAccess, /app_metadata[\s\S]*?role[\s\S]*?admin/i);
  assert.match(imageAccess, /public\.can_view_business_image\(name\)/i);
});

test('migração de país aceita somente BR/PY e não classifica país desconhecido por suposição', () => {
  assert.match(countryMigration, /raise exception[\s\S]*?country nulo, vazio ou não reconhecido/i);
  assert.match(countryMigration, /check\s*\(country_code\s+in\s*\('BR',\s*'PY'\)\)/i);
  assert.match(countryMigration, /alter column country_code set not null/i);
});

const appSource = read('../src/main.jsx');

test('novo anúncio grava country_code do mercado e preserva o país legado', () => {
  assert.match(appSource, /country:\s*market\.legacyCountry[\s\S]*?country_code:\s*market\.code/);
});


test('painel administrativo global não limita anúncios ao mercado da rota', () => {
  const start = appSource.indexOf('async function loadAdminBusinesses()');
  const end = appSource.indexOf('\n  async function ', start + 10);
  assert.ok(start >= 0 && end > start, 'Função administrativa não encontrada');
  const adminQuery = appSource.slice(start, end);
  assert.doesNotMatch(adminQuery, /\.eq\('country_code',\s*market\.code\)/);
});

test('consultas de anúncios usam country_code como filtro operacional BR/PY', () => {
  assert.match(appSource, /\.eq\('country_code',\s*market\.code\)/);
  assert.doesNotMatch(appSource, /\.eq\('country',\s*market\.legacyCountry\)/);
});

test('avaliações aprovadas continuam públicas, mas leitura privada exige mercado da sessão', () => {
  assert.match(reviewMigration, /status\s*=\s*'approved'/i);
  assert.match(reviewMigration, /user_id\s*=\s*auth\.uid\(\)[\s\S]*?b\.country_code\s*=\s*\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'market_code'\)/i);
  assert.match(reviewMigration, /role'\s*\)\s*=\s*'admin'/i);
});

test('envio de avaliação exige anúncio aprovado no mercado confiável da sessão', () => {
  const insertPolicy = reviewMigration.match(/create policy "Authenticated users submit pending business reviews"[\s\S]*?;/i)?.[0] ?? '';
  assert.match(insertPolicy, /status\s*=\s*'pending'/i);
  assert.match(insertPolicy, /b\.status\s*=\s*'approved'/i);
  assert.match(insertPolicy, /b\.country_code\s*=\s*\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'market_code'\)/i);
});

test.todo('Integração RLS: proprietário A não lê nem altera anúncios do proprietário B.');
test.todo('Integração Storage: usuário A não envia, substitui, lê ou remove imagens do anúncio B.');
test.todo('Integração de país: sessão BR não acessa anúncios/imagens PY e vice-versa.');
test.todo('Integração pública: anúncios aprovados BR e PY permanecem públicos; a interface filtra a vitrine pelo country_code selecionado.');
