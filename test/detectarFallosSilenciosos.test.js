// Tests da detección de fallos silenciosos do scraper.
import { test, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';

const { loadDB, createTable, insertIntoTable } = require('../lib/sqliteAccions');
const { detectarFallosSilenciosos } = require('../lib/detectarFallosSilenciosos');

const FIXTURES = 'test/fixtures';
// loadDB engade '.db' e prepende './', así que pasamos un nome base relativo (sen extensión)
const tmpBase = `test/fixtures/tmp_detector_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const tmpDbFile = path.join(process.cwd(), tmpBase + '.db');

beforeAll(() => {
  fs.mkdirSync(path.join(process.cwd(), FIXTURES), { recursive: true });
  loadDB(tmpBase);
});

afterAll(() => {
  try { fs.unlinkSync(tmpDbFile); } catch (e) { /* non importa */ }
});

test('alerta cando a táboa non se atopa pero ten histórico', () => {
  createTable('taboa_con_historico', ['Expediente']);
  insertIntoTable('taboa_con_historico', ['Expediente'], ['EXP-1', 'http://url/1']);
  insertIntoTable('taboa_con_historico', ['Expediente'], ['EXP-2', 'http://url/2']);

  const alertas = detectarFallosSilenciosos([
    { table: 'taboa_con_historico', encontrada: false, tenResultados: false, url: 'https://perfil.test/xunta' },
  ]);

  expect(alertas.length).toBe(1);
  expect(alertas[0]).toContain('taboa_con_historico');
  expect(alertas[0]).toContain('2 rexistro(s) histórico(s)');
  // o link directo ao perfil debe aparecer (fix: alerta con link)
  expect(alertas[0]).toContain('https://perfil.test/xunta');
  expect(alertas[0]).toContain('🔗 Perfil');
});

test('alerta cando a táboa existe pero non devolveu resultados (con histórico)', () => {
  const alertas = detectarFallosSilenciosos([
    { table: 'taboa_con_historico', encontrada: true, tenResultados: false, url: 'https://perfil.test/xunta' },
  ]);
  expect(alertas.length).toBe(1);
  expect(alertas[0]).toContain('non devolveu resultados');
  expect(alertas[0]).toContain('https://perfil.test/xunta');
});

test('NON inclúe liña de perfil se o resumo non ten url', () => {
  const alertas = detectarFallosSilenciosos([
    { table: 'taboa_con_historico', encontrada: false, tenResultados: false },
  ]);
  expect(alertas.length).toBe(1);
  expect(alertas[0]).not.toContain('🔗 Perfil');
});

test('NON alerta cando está todo correcto', () => {
  const alertas = detectarFallosSilenciosos([
    { table: 'taboa_con_historico', encontrada: true, tenResultados: true },
  ]);
  expect(alertas.length).toBe(0);
});

test('NON alerta nunha táboa sen histórico (pode estar lexitimamente baleira)', () => {
  const alertas = detectarFallosSilenciosos([
    { table: 'taboa_nova_sin_historico', encontrada: false, tenResultados: false },
  ]);
  expect(alertas.length).toBe(0);
});