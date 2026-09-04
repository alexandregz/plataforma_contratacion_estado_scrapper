// Tests unitarios dos helpers de sqliteAccions (sen tocar a web nin BD reais).
import { test, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';

const {
  loadDB,
  createTable,
  insertIntoTable,
  existsRecord,
  getAllIDsfromEntityBetweenDates,
  getTotalFilesFromExpediente,
  totalRowsInTable,
  normalizeEuroValue,
  maxDataPublicacionBD,
} = require('../lib/sqliteAccions');

const FIXTURES = 'test/fixtures';
// loadDB engade '.db' e prepende './', así que pasamos un nome base relativo (sen extensión)
const tmpBase = `test/fixtures/tmp_sqlite_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const tmpDbFile = path.join(process.cwd(), tmpBase + '.db');

const CABECEIRAS = ['Expediente', 'Tipo', 'Importe'];
const TABLA = 'test_licitacions';

beforeAll(() => {
  fs.mkdirSync(path.join(process.cwd(), FIXTURES), { recursive: true });
  loadDB(tmpBase);
  createTable(TABLA, CABECEIRAS);
});

afterAll(() => {
  try { fs.unlinkSync(tmpDbFile); } catch (e) { /* non importa */ }
});

test('createTable crea a táboa e totalRowsInTable conta rexistros', () => {
  expect(totalRowsInTable(TABLA)).toBe(0);
  insertIntoTable(TABLA, CABECEIRAS, ['EXP-0001', 'Obra', '10.400,00', 'http://url/x']);
  expect(totalRowsInTable(TABLA)).toBe(1);
  insertIntoTable(TABLA, CABECEIRAS, ['EXP-0002', 'Servizo', '2.100,50', 'http://url/y']);
  expect(totalRowsInTable(TABLA)).toBe(2);
});

test('totalRowsInTable devolve 0 para táboa inexistente', () => {
  expect(totalRowsInTable('taboa_que_non_existe')).toBe(0);
});

test('existsRecord: booleano estrito true/false', () => {
  expect(existsRecord(TABLA, CABECEIRAS, ['EXP-NONEXISTE'])).toBe(false);
  expect(existsRecord(TABLA, CABECEIRAS, ['EXP-0001'])).toBe(true);
});

test('getTotalFilesFromExpediente conta ficheiros dun expediente', () => {
  const TABLA_FILES = TABLA + '_files';
  createTable(TABLA_FILES, ['filename', 'Expediente', 'tipo']);
  insertIntoTable(TABLA_FILES, ['filename', 'Expediente', 'tipo'], ['a.pdf', 'EXP-0001', 'documento pdf', 'http://url/a']);
  insertIntoTable(TABLA_FILES, ['filename', 'Expediente', 'tipo'], ['b.pdf', 'EXP-0001', 'documento pdf', 'http://url/b']);
  expect(getTotalFilesFromExpediente(TABLA_FILES, 'EXP-0001')).toBe(2);
  expect(getTotalFilesFromExpediente(TABLA_FILES, 'EXP-DESCOÑECIDO')).toBe(0);
});

test('getAllIDsfromEntityBetweenDates devolve rexistros de hoxe', () => {
  const hoxe = new Date().toISOString().slice(0, 10);
  const manha = new Date(new Date(hoxe).setDate(new Date().getDate() + 1)).toISOString().slice(0, 10);
  // os rexistros insírense con fecha_insercio = datetime('now','localtime'), así que caen en [hoxe, manha]
  const rows = getAllIDsfromEntityBetweenDates(TABLA, hoxe, manha);
  expect(rows.length).toBeGreaterThanOrEqual(1);
  expect(rows[0].Expediente).toBeDefined();
});

test('normalizeEuroValue normaliza importes europeos e ingleses', () => {
  // europeo correcto pero quita puntos de milleiro
  expect(normalizeEuroValue('10.400,00')).toBe('10400,00')
  // inglés: comas de milleiro e punto decimal -> europeo
  expect(normalizeEuroValue('10,400.00')).toBe('10400,00');
  // só puntos de milleiro
  expect(normalizeEuroValue('1.000')).toBe('1000');
  // sen símbolos
  expect(normalizeEuroValue('Obra')).toBe('Obra');
  // non-string pasa tal cal
  expect(normalizeEuroValue(123)).toBe(123);
});

test('maxDataPublicacionBD: máximo sobre celas parseables', () => {
  createTable('taboa_datas', ['Expediente', 'Fechas']);
  insertIntoTable('taboa_datas', ['Expediente', 'Fechas'], ['E1', '2025-05-12', 'http://u1']);
  insertIntoTable('taboa_datas', ['Expediente', 'Fechas'], ['E2', '2025-05-18', 'http://u2']);
  insertIntoTable('taboa_datas', ['Expediente', 'Fechas'], ['E3', '2025-05-15', 'http://u3']);

  const max = maxDataPublicacionBD('taboa_datas', 'Fechas');
  expect(max).toBe(new Date(Date.UTC(2025, 4, 18)).getTime());
});

test('maxDataPublicacionBD: táboa/columna ausente devolve null', () => {
  expect(maxDataPublicacionBD('taboa_que_non_existe', 'Fechas')).toBeNull();
  // táboa existe pero columna inexistente
  expect(maxDataPublicacionBD('taboa_datas', 'Columna_Que_Non_Existe')).toBeNull();
});

test('maxDataPublicacionBD: só valores ilexibles devolve null', () => {
  createTable('taboa_datas_ilexibles', ['Expediente', 'Fechas']);
  insertIntoTable('taboa_datas_ilexibles', ['Expediente', 'Fechas'], ['E1', 'En trámite', 'http://u1']);
  insertIntoTable('taboa_datas_ilexibles', ['Expediente', 'Fechas'], ['E2', 'N/A', 'http://u2']);
  expect(maxDataPublicacionBD('taboa_datas_ilexibles', 'Fechas')).toBeNull();
});