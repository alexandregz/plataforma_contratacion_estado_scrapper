// Unit tests dos helpers puros de data (SDD: page-limit-by-date).
import { test, expect } from 'bun:test';

const { localizarIndiceColunaData, normalizarDataWeb, debePararPorData } = require('../lib/parsearDatas');

test('localizarIndiceColunaData: atopa "Fecha publicación"', () => {
  const idx = localizarIndiceColunaData([
    ['Expediente'],
    ['Fecha publicación'],
    ['Importe'],
  ]);
  expect(idx).toBe(1);
});

test('localizarIndiceColunaData: atopa "Fechas"/"Fecha(s)" pola clave fecha', () => {
  expect(localizarIndiceColunaData([['Expediente'], ['Fechas'], ['Importe']])).toBe(1);
  expect(localizarIndiceColunaData([['Fecha(s)'], ['Expediente']])).toBe(0);
});

test('localizarIndiceColunaData: sen columna de data devolve -1', () => {
  expect(localizarIndiceColunaData([['Expediente'], ['Importe'], ['Estado']])).toBe(-1);
});

test('localizarIndiceColunaData: preferencia por "publicaci" sobre "fecha"', () => {
  const idx = localizarIndiceColunaData([
    ['Expediente'],
    ['Fecha de recepción'],
    ['Fecha de publicación'],
  ]);
  // o header que contén "publicaci" gaña
  expect(idx).toBe(2);
});

test('localizarIndiceColunaData: case-insensitive', () => {
  expect(localizarIndiceColunaData([['Expediente'], ['FECHA PUBLICACIÓN']])).toBe(1);
});

test('normalizarDataWeb: formatos válidos europeos', () => {
  const a = normalizarDataWeb('12/11/2025');
  const b = normalizarDataWeb('12/11/2025 14:30');
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  // con hora, o mesmo día é máis tarde (nunha mesma unidade comparable)
  expect(b).toBeGreaterThan(a);
});

test('normalizarDataWeb: formato AAAA-MM-DD con separadores - . /', () => {
  expect(normalizarDataWeb('2025-11-12')).not.toBeNull();
  expect(normalizarDataWeb('2025.11.12')).toBe(normalizarDataWeb('2025-11-12'));
  expect(normalizarDataWeb('2025/11/12')).toBe(normalizarDataWeb('2025-11-12'));
});

test('normalizarDataWeb: equivalentes europeo e ISO do mesmo día', () => {
  expect(normalizarDataWeb('12/11/2025')).toBe(normalizarDataWeb('2025-11-12'));
});

test('normalizarDataWeb: non parseables devolven null', () => {
  expect(normalizarDataWeb('En trámite')).toBeNull();
  expect(normalizarDataWeb('-')).toBeNull();
  expect(normalizarDataWeb('N/A')).toBeNull();
  expect(normalizarDataWeb('')).toBeNull();
  expect(normalizarDataWeb('   ')).toBeNull();
  expect(normalizarDataWeb(null)).toBeNull();
  expect(normalizarDataWeb(20251112)).toBeNull();
  expect(normalizarDataWeb(undefined)).toBeNull();
  expect(normalizarDataWeb('31/02/2025')).toBeNull(); // día inválido
  expect(normalizarDataWeb('13/13/2025')).toBeNull(); // mes inválido
  expect(normalizarDataWeb('12/12/25')).toBeNull();   // ano 2 díxitos
});

test('debePararPorData: máis vella que o horizonte → true', () => {
  expect(debePararPorData(normalizarDataWeb('30/10/2025'), normalizarDataWeb('01/11/2025'))).toBe(true);
});

test('debePararPorData: igual ou máis recente → false', () => {
  expect(debePararPorData(normalizarDataWeb('01/11/2025'), normalizarDataWeb('01/11/2025'))).toBe(false);
  expect(debePararPorData(normalizarDataWeb('10/11/2025'), normalizarDataWeb('01/11/2025'))).toBe(false);
});

test('debePararPorData: sen histórico (horizonte null) → false', () => {
  expect(debePararPorData(normalizarDataWeb('30/10/2025'), null)).toBe(false);
});

test('debePararPorData: data ilexible (null) → false (fallback conservador)', () => {
  expect(debePararPorData(null, normalizarDataWeb('01/11/2025'))).toBe(false);
});