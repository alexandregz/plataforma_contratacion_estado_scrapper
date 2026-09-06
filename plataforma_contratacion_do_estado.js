/**
 * scrapper de Plataforma de Contratacion do Estado
 * 
 * Requerimentos: puppeteer, bun:sqlite, node:fs, node:stream, node:util
 *   execute: $ bun plataforma_contratacion_do_estado.js concello.json [database_nome (sen extension)]
 * 
 * ver exemplo.json para config
 * 
 * NOTA: empregar "node plataforma_contratacion_do_estado.js" se dá erro o sqlite3 de dyld[xxxx] ou similar
 */

// ten que ir de primeiro, para saltar o TLS_UNATHORIZED (se o cert est� mal configurado)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const puppeteer = require('puppeteer');

// db (as de createTable, insertIntoTable,... empreganse no parseador e aqui non fan falha)
const { loadDB } = require('./lib/sqliteAccions');

// parseador de licitacions e contratos menores
const { parsearResultadosLicitacionsContratos } = require('./lib/parsearResultadosLicitacionsContratos');

// alerta de fallos silenciosos
const { enviarCorreoAlertas, enviarCorreoDebugStart, enviarCorreoDebugEnd, enviarCorreoUnicoAgregado } = require('./lib/enviarCorreoNovosExpedientes');

// detección de táboas que non produciron resultados con histórico previo
const { detectarFallosSilenciosos } = require('./lib/detectarFallosSilenciosos');


// --- uso
//  CONCELLO.json é un json key/value, sendo key o nome da entidade e value a URL directa (ver Perfil Contratante)
//  database.db e por se empregamos un ficheiro temporal (ames_skipped.json, por exemplo), para seguir gardando en taboas reais (ames.db, por exemplo)
function usage() {
  console.log('Uso: ' + process.argv[0] + ' ' + process.argv[1] + ' CONCELLO.json [DATABASE_NOME (sen .db)]')
  process.exit(0);
}
if (!process.argv[2]) {
  usage()
}

// empregado como nome da database.db
const concello = process.argv[2].replace('.json', '')

let nome_db = concello
if (process.argv[3]) {
  nome_db = process.argv[3]
}

// cargar db
loadDB(nome_db)

// ler config
const { CONFIG } = require('./lib/config.js');

    // momento de inicio (para os correos de debug e a duración)
    const horaInicio = new Date();


(async () => {
  try { await enviarCorreoDebugStart(concello); } catch (e) { console.error('Non se puido enviar o correo de inicio:', e); }
      const browser = await puppeteer.launch();
  // const browser = await puppeteer.launch({headless: false});

  const page = await browser.newPage();

  //const timeout = 5000;
  const timeout = 0;
  page.setDefaultTimeout(timeout);

  {
    const targetPage = page;
    await targetPage.setViewport({
      width: 1800,
      height: 800
    })
  }

  // recolle o estado de cada táboa revisada para detectar fallos silenciosos ao final
  const resumos = [];
      const tablesRevisadas = [];

  // as entidades do .json vanse recorrendo unha a unha
  for (const entidade in CONFIG.ENTIDADES) {
    const entidade_db = entidade.replace(/ /g, "_")

    const url = CONFIG.ENTIDADES[entidade].url

    // GOTO pages
    console.log("📍 Aberta " + entidade + " de " + concello + ": " + url)
    {
      const targetPage = page;
      const promises = [];
      const startWaitingForEvents = () => {
        promises.push(targetPage.waitForNavigation());
      }
      startWaitingForEvents();
      // esta url hai que quitala manualmente, buscando o Perfil Contratante (ToDo extraelas automaticamente tamen?)
      await targetPage.goto(url);
      await Promise.all(promises);

      // CLICK en LICITACIONS e CONTRATOS MENORES (que son os que nos importan, polo de agora)
      // object { nome_de_bd: value en input, ... }
      const TIPOS_A_REVISAR = { [entidade_db + '_licitacions']: "Licitaciones", [entidade_db + '_contratos_menores']: "Contratos Menores" };

      for (const db_name in TIPOS_A_REVISAR) {
        console.log(" ✏️ " + TIPOS_A_REVISAR[db_name] + "...")
        {
          const targetPage = page;
          const promises = [];
          const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
          }
          await puppeteer.Locator.race([
            targetPage.locator('input[value="' + TIPOS_A_REVISAR[db_name] + '"]'),
          ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click();
          await Promise.all(promises);
        }

        // exportada loxica a módulo
        resumos.push(await parsearResultadosLicitacionsContratos(browser, page, db_name, concello, entidade))
            tablesRevisadas.push(db_name)
      }
    }
    console.log(" ");
  }

  // ALERTA de fallos silenciosos despois de revisar todas as entidades
  try { await enviarCorreoUnicoAgregado(concello, tablesRevisadas); } catch (e) { console.error('Non se puido enviar o correo único:', e); }

      const alertas = detectarFallosSilenciosos(resumos);
  if (alertas.length > 0) {
    try {
      await enviarCorreoAlertas(concello, alertas);
    } catch (e) {
      console.error('Non se puido enviar a alerta de fallo silencioso:', e);
    }
  } else {
    console.log(' ✅ Sen fallos silenciosos detectados');
  }

  await browser.close();

      // correo de fin de depuración (execución correcta)
      try { await enviarCorreoDebugEnd(concello, horaInicio); } catch (e) { console.error('Non se puido enviar o correo de fin:', e); }

})().catch(async (err) => {
  console.error(err);
      // correo de fin de depuración (execución con erro)
      try { await enviarCorreoDebugEnd(concello, horaInicio, err); } catch (e) { console.error('Non se puido enviar o correo de fin (erro):', e); }
  // alerta de erro fatal: o run morreu antes de rematar
  try {
    await enviarCorreoAlertas(concello, [`Erro fatal durante a execución: ${err.message || err}`]);
  } catch (e) {
    console.error('Non se puido enviar a alerta de erro fatal:', e);
  }
  process.exit(1);
});