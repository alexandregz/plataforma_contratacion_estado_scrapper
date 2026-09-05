// Smoke test do envío de correos: reproduce o fallo con config de email baleira
// (ex.: ames_skipped.json) e comproba que non intenta enviar nin peta.
// Interceptamos 'emailjs' con mock.module para NON enviar correos reais.
import { test, expect, beforeAll, afterAll, mock } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Rexistro das mensaxes que intentaría enviar SMTPClient (non se envía nada de verdade)
const enviados = [];
mock.module('emailjs', () => ({
  SMTPClient: class {
    constructor(server) { this.server = server; }
    send(msg, cb) { enviados.push(msg); cb(null, msg); }
  },
}));

const FIXTURES = 'test/fixtures';
const emptyCfgRel = 'test/fixtures/tmp_empty_email.json';
const fullCfgRel = 'test/fixtures/tmp_full_email.json';
let emptyCfgAbs, fullCfgAbs, tmpDbBase, tmpDbFile;

function abs(rel) { return path.join(process.cwd(), rel); }

function recargarModulosEmail() {
  // NO borramos sqliteAccions da cache: iso rompería a ligazón a DB (loadDB é unha vez).
  // A copia cacheada xa ten as funcións de dedup exportadas.
  delete require.cache[require.resolve('../lib/config.js')];
  delete require.cache[require.resolve('../lib/enviarCorreoNovosExpedientes.js')];
  return require('../lib/enviarCorreoNovosExpedientes.js');
}

beforeAll(() => {
  fs.mkdirSync(abs(FIXTURES), { recursive: true });
  emptyCfgAbs = abs(emptyCfgRel);
  fullCfgAbs = abs(fullCfgRel);
  // igual que ames_skipped.json: sen email configurado
  fs.writeFileSync(emptyCfgAbs, JSON.stringify({ ENTIDADES: {}, EMAIL_CAMPOS_ENVIO: {}, EMAIL_CONFIG: {} }));
  // config completa
  fs.writeFileSync(fullCfgAbs, JSON.stringify({
    ENTIDADES: {},
    EMAIL_CAMPOS_ENVIO: { from: 'remitente@test.local', to: 'destino@test.local' },
    EMAIL_CONFIG: { user: 'user', password: 'pass', host: 'smtp.test.local', ssl: true },
  }));

  tmpDbBase = `test/fixtures/tmp_db_${Date.now()}`;
  tmpDbFile = abs(tmpDbBase + '.db');

  // config.js lee './' + process.argv[2]; deixamos apuntada a config baleira por defecto
  process.argv[2] = emptyCfgRel;
});

afterAll(() => {
  for (const f of [emptyCfgAbs, fullCfgAbs, tmpDbFile]) {
    try { fs.unlinkSync(f); } catch (e) { /* non importa */ }
  }
});

test('emailConfigurado() é false con config baleira e true con config completa', () => {
  const { emailConfigurado } = require('../lib/enviarCorreoNovosExpedientes.js');
  expect(emailConfigurado({ EMAIL_CAMPOS_ENVIO: {}, EMAIL_CONFIG: {} })).toBe(false);
  expect(emailConfigurado({ EMAIL_CAMPOS_ENVIO: { from: 'x' }, EMAIL_CONFIG: {} })).toBe(false);
  expect(emailConfigurado({ EMAIL_CAMPOS_ENVIO: {}, EMAIL_CONFIG: { host: 'smtp' } })).toBe(false);
  expect(emailConfigurado({
    EMAIL_CAMPOS_ENVIO: { from: 'x', to: 'y' },
    EMAIL_CONFIG: { host: 'smtp' },
  })).toBe(true);
});

test('con config de email baleira non intenta enviar e non peta (regresión do erro)', async () => {
  process.argv[2] = 'test/fixtures/tmp_empty_email.json';
  const { loadDB, createTable, insertIntoTable } = require('../lib/sqliteAccions');
  loadDB(tmpDbBase);
  createTable('tbl_alerta', ['Expediente']);
  insertIntoTable('tbl_alerta', ['Expediente'], ['EXP-ALERTA-1', 'http://url/x']);

  const mod = recargarModulosEmail();
  expect(mod.emailConfigurado()).toBe(false);

  const enviadosAntes = enviados.length;
  // debería devolver null, omitindo o envío (e non lanzar "message is not a valid Message instance")
  const resultado = await mod.enviarCorreoNovosExpedientes('teste', 'tbl_alerta');
  expect(resultado).toBeNull();
  expect(enviados.length).toBe(enviadosAntes); // non se intentou enviar ningún
});

test('con config completa si envía (vía SMTPClient mockeado)', async () => {
  process.argv[2] = 'test/fixtures/tmp_full_email.json';
  const mod = recargarModulosEmail(); // CONFIG completa
  expect(mod.emailConfigurado()).toBe(true);

  const enviadosAntes = enviados.length;
  await mod.enviarCorreoAlertas('teste', ['Táboa X: posible fallo silencioso']);
  expect(enviados.length).toBe(enviadosAntes + 1);

  const ultimo = enviados[enviados.length - 1];
  expect(ultimo.subject).toContain('ALERTA');
  expect(ultimo.from).toBe('remitente@test.local');
  expect(ultimo.text).toContain('Táboa X');
});

test('non reenvía o mesmo expediente xa notificado (dedup en re-execución)', async () => {
  process.argv[2] = 'test/fixtures/tmp_full_email.json';
  const mod = recargarModulosEmail();
  // tbl_alerta (con EXP-ALERTA-1 inserido hoxe) foi creada no test de config baleira
  const antes = enviados.length;

  // primeira execución: envíase e márcase en email_enviados
  const r1 = await mod.enviarCorreoNovosExpedientes('teste', 'tbl_alerta');
  expect(r1).not.toBeNull();
  expect(enviados.length).toBe(antes + 1);

  // segunda execución o mesmo día: dedup ⇒ non se envía
  const r2 = await mod.enviarCorreoNovosExpedientes('teste', 'tbl_alerta');
  expect(r2).toBeNull();
  expect(enviados.length).toBe(antes + 1);
});

test('todos os de hoxe xa notificados devolve null (sen envío)', async () => {
  process.argv[2] = 'test/fixtures/tmp_full_email.json';
  const mod = recargarModulosEmail();
  const r = await mod.enviarCorreoNovosExpedientes('teste', 'tbl_alerta');
  expect(r).toBeNull();
});