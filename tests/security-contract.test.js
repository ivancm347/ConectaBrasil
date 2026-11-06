import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MARKETS } from '../src/lib/market.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const imageMigration = read('../supabase/migrations/20261106120000_secure_business_image_ownership.sql');
const bucketSetup = read('../supabase/business_images.sql');
const imageAccess = read('../supabase/fix_business_image_access.sql');
const countryMigration = read('../supabase/migrations/20261106090000_add_business_country_code.sql');

function policyBlock(policyName) {
  const escaped = policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = imageMigration.match(new RegExp('create policy "' + escaped + '"[\\s\\S]*?;','i'));
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
  assert.match(sql, /exists\s*\([\s\S]*?from\s+public\.businesses\s+b[\s\S]*?b\.id::text\s*=\s*\(storage\.foldername\(name\)\)\[2\][\s\S]*?b\.owner_id\s*=\s*auth\.uid\(\)/i);
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

test('leitura de imagens continua mediada por can_view_business_image', () => {
  assert.match(imageAccess, /security\s+definer/i);
  assert.match(imageAccess, /set\s+search_path\s*=\s*public,\s*storage,\s*pg_temp/i);
  assert.match(imageAccess, /b\.status\s*=\s*'approved'/i);
  assert.match(imageAccess, /b\.owner_id\s*=\s*auth\.uid\(\)/i);
  assert.match(imageAccess, /app_metadata[\s\S]*?role[\s\S]*?admin/i);
  assert.match(imageAccess, /public\.can_view_business_image\(name\)/i);
});

test('migração de país aceita somente BR/PY e não classifica país desconhecido por suposição', () => {
  assert.match(countryMigration, /raise exception[\s\S]*?country nulo, vazio ou não reconhecido/i);
  assert.match(countryMigration, /check\s*\(country_code\s+in\s*\('BR',\s*'PY'\)\)/i);
  assert.match(countryMigration, /alter column country_code set not null/i);
});

test.todo('Integração RLS: proprietário A não lê nem altera anúncios do proprietário B.');
test.todo('Integração Storage: usuário A não envia, substitui, lê ou remove imagens do anúncio B.');
test.todo('Integração de país: sessão BR não acessa anúncios/imagens PY e vice-versa.');
test.todo('Integração pública: anúncios e imagens aprovados aparecem somente no mercado correto.');
