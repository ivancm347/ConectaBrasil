import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MARKETS, formatMarketCurrency } from '../src/lib/market.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const imageMigration = read('../supabase/migrations/20261106150000_secure_business_image_storage_policies.sql');
const bucketSetup = read('../supabase/business_images.sql');
const imageAccess = imageMigration;
const countryMigration = read('../supabase/migrations/20261106090000_add_business_country_code.sql');
const reviewMigration = read('../supabase/migrations/20261106160000_scope_business_reviews_by_market.sql');

function policyBlock(policyName) {
  const marker = `create policy "${policyName}"`;
  const start = imageMigration.toLowerCase().indexOf(marker.toLowerCase());
  assert.notEqual(start, -1, `Política ausente: ${policyName}`);
  const end = imageMigration.indexOf(';', start);
  assert.notEqual(end, -1, `Bloco SQL incompleto: ${policyName}`);
  return imageMigration.slice(start, end + 1);
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


const metricsHardeningMigration = read('../supabase/migrations/20261106223000_harden_reviews_and_market_metrics.sql');

test('migração de endurecimento mantém avaliações privadas limitadas ao mercado confiável', () => {
  assert.match(metricsHardeningMigration, /create policy "Public read approved business reviews"[\s\S]*?status = 'approved'/i);
  assert.match(metricsHardeningMigration, /business_reviews\.user_id = auth\.uid\(\)[\s\S]*?b\.country_code\s*=\s*\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'market_code'\)/i);
  assert.match(metricsHardeningMigration, /business_reviews\.status = 'pending'[\s\S]*?b\.status = 'approved'[\s\S]*?b\.country_code\s*=\s*\(auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'market_code'\)/i);
});

test('funções SECURITY DEFINER de métricas usam search_path vazio', () => {
  const functionDefinitions = metricsHardeningMigration.match(/create or replace function[\s\S]*?\$function\$;/gi) ?? [];
  assert.equal(functionDefinitions.length, 3);
  for (const definition of functionDefinitions) {
    assert.match(definition, /security definer/i);
    assert.match(definition, /set search_path = ''/i);
  }
});

test('registro público de métricas aceita somente métricas permitidas e empresas aprovadas', () => {
  assert.match(metricsHardeningMigration, /p_metric is null[\s\S]*?p_metric not in \('views_count', 'whatsapp_clicks'\)/i);
  assert.match(metricsHardeningMigration, /where id = p_business_id[\s\S]*?and status = 'approved'/i);
  assert.match(metricsHardeningMigration, /grant execute on function\s+public\.increment_business_metric\(uuid, text\)\s+to anon, authenticated, service_role/i);
  assert.match(metricsHardeningMigration, /revoke all on function\s+public\.increment_business_metric\(uuid, text\)\s+from public, anon, authenticated, service_role/i);
});

test('RPC de métricas por mercado exige admin e filtra BR/PY', () => {
  assert.match(metricsHardeningMigration, /get_admin_business_metrics_by_market/i);
  assert.match(metricsHardeningMigration, /is distinct from 'admin'/i);
  assert.match(metricsHardeningMigration, /p_country_code not in \('BR', 'PY'\)/i);
  assert.match(metricsHardeningMigration, /b\.country_code = p_country_code/i);
  assert.match(metricsHardeningMigration, /grant execute on function\s+public\.get_admin_business_metrics_by_market\(date, text\)\s+to authenticated, service_role/i);
  assert.match(metricsHardeningMigration, /revoke all on function\s+public\.get_admin_business_metrics_by_market\(date, text\)\s+from public, anon, authenticated, service_role/i);
});


const publicMarketMigration = read('../supabase/migrations/20261107110000_scope_public_business_listing_by_market_header.sql');
const supabaseClientSource = read('../src/lib/supabase.js');
const appSource = read('../src/main.jsx');

test('vitrine pública respeita o mercado selecionado sem usar o cabeçalho como autorização privada', () => {
  const policyStart = publicMarketMigration.indexOf('CREATE POLICY "Market public read approved businesses"');
  const policyEnd = publicMarketMigration.indexOf(';', policyStart);
  assert.notEqual(policyStart, -1);
  assert.notEqual(policyEnd, -1);
  const policy = publicMarketMigration.slice(policyStart, policyEnd + 1);
  assert.ok(policy.includes("status = 'approved'"));
  assert.ok(policy.includes("current_setting('request.headers', true)"));
  assert.ok(policy.includes("'x-market-code'"));
  assert.ok(policy.includes("auth.jwt() -> 'app_metadata' ->> 'market_code'"));
  assert.ok(policy.includes("country_code IN ('BR', 'PY')"));
  assert.ok(supabaseClientSource.includes('const selectedMarketCode = getMarketFromPath().code'));
  assert.ok(supabaseClientSource.includes("'x-market-code': selectedMarketCode"));
});

test('formatação monetária usa moeda e localidade do mercado', () => {
  assert.match(formatMarketCurrency(1234.56, 'BR'), /R\$/);
  assert.match(formatMarketCurrency(1234.56, 'PY'), /1\.235/);
  assert.equal(MARKETS.PY.currency, 'PYG');
  assert.equal(MARKETS.PY.enabled, false);
});

test('relatório administrativo não atribui preços brasileiros ao mercado paraguaio', () => {
  assert.ok(appSource.includes("market.code === 'BR' ? (planType === 'destaque' ? 29.90"));
  assert.ok(appSource.includes('{es ? <section className="admin-category-manager" style={{marginTop:18}}>'));
  assert.ok(appSource.includes('Os preços dos planos paraguaios ainda não foram definidos.'));
});
