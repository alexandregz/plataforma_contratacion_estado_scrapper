/**
 * Importante engadir '"type": "module",' a package.json, porque emailjs forza a empregalo como un módulo ECMAScript, non CommonJS
 */
import { SMTPClient } from 'emailjs';

// ler config
const { CONFIG } = require('./config.js');

// Envía un correo xenérico (subject + texto) usando a conta de EMAIL_CONFIG.
// Indica se a configuración de email está completa para poder enviar.
// Devolve false (e non se envía) cando falta EMAIL_CAMPOS_ENVIO.from ou EMAIL_CONFIG.host,
// como nos configs de proba (ex.: ames_skipped.json) que non queren enviar correos.
// Acepta unha config por parámetro para facilitar os tests; por defecto usa a global CONFIG.
export function emailConfigurado(config = CONFIG) {
  return !!(config.EMAIL_CAMPOS_ENVIO && config.EMAIL_CAMPOS_ENVIO.from &&
    config.EMAIL_CONFIG && config.EMAIL_CONFIG.host);
}

// Usamos unha copia (spread) de EMAIL_CAMPOS_ENVIO para non mutar o obxecto compartido da config.
function enviarCorreo(subject, text) {
  // Se non hai config de email, non se intenta enviar (evita o erro de emailjs
  // "message is not a valid Message instance" con config baleira).
  if (!emailConfigurado()) {
    console.log(' ⚠️ Email non configurado (falta EMAIL_CAMPOS_ENVIO.from e/ou EMAIL_CONFIG.host): omítese o envío.');
    return Promise.resolve(null);
  }

  const mensaxe = { ...CONFIG.EMAIL_CAMPOS_ENVIO, subject, text };
  const client = new SMTPClient(CONFIG.EMAIL_CONFIG);

  return new Promise((resolve, reject) => {
    client.send(mensaxe, (err, message) => {
      if (err) {
        reject(err);
      } else {
        resolve(message);
      }
    });
  });
}

// Extrae o identificador (primeira columna = expediente/key) dunha fila do .all de bun:sqlite.
function idExpediente(fila) {
  const chave = Object.keys(fila || {})[0];
  return chave != null ? String(fila[chave]) : null;
}

// recibe array de obxectos ({Expediente:"xxxx",...}) cos expedientes pendentes de notificación.
export function enviarCorreoNovosExpedientes(concello, table, data) {
  // Lazy require: evita problemas de require.cache en Bun e asegura a versión actual.
  const { getExpedientesNonNotificados, marcarExpedientesEnviados } = require('./sqliteAccions');

  // Traemos TODOS os expedientes que aínda non foron notificados (non depende da data: hoxe, onte, antonte...).
  const pendentes = getExpedientesNonNotificados(table);

  // NON se envía email se non hai expedientes por notificar nesta entidade+tipo de contrato
  if (pendentes.length === 0) {
    console.log(` 📭 Non hai expedientes pendentes de notificar en ${table}: non se envía email.`);
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const subject = `Scrapper plat. contrat. Estado ${today} ${concello} ${table}`;
  let txt = `${subject}\n\n`;

  // array de objects tipo { Expediente: "xxxx" }
  txt += `Novos Expedientes pendentes:\n\n`;
  pendentes.forEach(o => {
    Object.keys(o).forEach((k) => {
      let value = o[k];
      if (k == 'Estado') value = value.replace(/(\r\n|\r|\n)/g, '\n\t')    // en Estado hai texto multilinea

      if (k != 'fecha_insercion') txt += `\t ${k}: ${value}\n`;
    });
    txt += "\n";
  });

  // console.log(txt)
  // process.exit(0)

  return enviarCorreo(subject, txt).then((res) => {
    // tralo envío EXITOSO (res truthy; non se marca se se omitiu por non haber email configurado),
    // marcamolos como notificados para non reenvialos en re-execucións.
    if (res) {
      const ids = pendentes.map(idExpediente).filter(x => x != null);
      marcarExpedientesEnviados(table, ids);
    }
    return res;
  });
}

// Envía UN só correo cos expedientes pendentes de todas as táboas, agrupado por táboa.
// Substituirá os correos individuais por táboa (correo-unico-agregado).
export function enviarCorreoUnicoAgregado(concello, tables) {
  const today = new Date().toISOString().slice(0, 10);
  const { getExpedientesNonNotificados, marcarExpedientesEnviados } = require('./sqliteAccions');

  const seccions = [];
  let totalPendentes = 0;
  for (const table of (tables || [])) {
    const pendentes = getExpedientesNonNotificados(table);
    if (!pendentes || pendentes.length === 0) continue;
    seccions.push({ table, rows: pendentes });
    totalPendentes += pendentes.length;
  }

  if (totalPendentes === 0) {
    console.log(' 📭 Non hai expedientes pendentes por notificar: non se envía correo único.');
    return null;
  }

  const subject = `Scrapper plat. contrat. Estado ${today} ${concello} — NOVOS PENDENTES`;
  let txt = `${subject}\n\n`;

  seccions.forEach(({ table, rows }) => {
    txt += `\n========== ${table} ==========\n\n`;
    rows.forEach(o => {
      Object.keys(o).forEach((k) => {
        let value = o[k];
        if (k == 'Estado') value = value.replace(/(\r\n|\r|\n)/g, '\n\t');    // en Estado hai texto multilinea
        if (k != 'fecha_insercion') txt += `\t ${k}: ${value}\n`;
      });
      txt += "\n";
    });
  });

  return enviarCorreo(subject, txt).then((res) => {
    if (res) {
      seccions.forEach(({ table, rows }) => {
        const ids = rows.map(idExpediente).filter(x => x != null);
        marcarExpedientesEnviados(table, ids);
      });
    }
    return res;
  });
}

// Envía un correo de alerta cando o scraper detecta fallos silenciosos
// (táboas que deberían ter data pero non se atoparon/non devolveron resultados).
export function enviarCorreoAlertas(concello, alertas) {
  const today = new Date().toISOString().slice(0, 10);
  const subject = `🚨 ALERTA Scrapper ${concello} — posible fallo silencioso`;

  let txt = `${subject}\n\n`;
  txt += `Detéctanse organismos/tipos que parecen fallar en silencio (táboas con histórico que non produciron resultados):\n\n`;
  alertas.forEach(a => { txt += `- ${a}\n`; });
  txt += `\nRevisa o HTML da Plataforma e o estado do scraper.\n`;

  console.log(` 🚨 Enviando alerta de fallo silencioso (${alertas.length}) para ${concello}`);
  return enviarCorreo(subject, txt);
}

// -- Correos de debug (fase de depuración) — controladores por EMAIL_DEBUG: true na config.

function formatarHora(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Correo de INICIO da execución (activado por CONFIG.EMAIL_DEBUG).
export function enviarCorreoDebugStart(concello) {
  if (!CONFIG.EMAIL_DEBUG) {
    console.log(' 🐞 EMAIL_DEBUG desactivado: omítese o correo de inicio.');
    return null;
  }
  const agora = new Date();
  const subject = `🐞 [DEBUG] Inicio Scrapper ${concello} — ${formatarHora(agora)}`;
  const txt = `${subject}\n\nComezou a execución do scraper para ${concello}.\nHora de inicio: ${agora.toLocaleString()}\n`;
  return enviarCorreo(subject, txt);
}

// Correo de FIN da execución (inclúe duración e, se houbo, o erro).
export function enviarCorreoDebugEnd(concello, horaInicio, err) {
  if (!CONFIG.EMAIL_DEBUG) {
    console.log(' 🐞 EMAIL_DEBUG desactivado: omítese o correo de fin.');
    return null;
  }
  const agora = new Date();
  const subject = `🐞 [DEBUG] Fin Scrapper ${concello} — ${formatarHora(agora)}`;
  let txt = `${subject}\n\nRematou a execución do scraper para ${concello}.\nHora de fin: ${agora.toLocaleString()}\n`;
  if (horaInicio instanceof Date) {
    const dur = Math.round((agora - horaInicio) / 1000);
    txt += `Duración: ${dur}s\n`;
  }
  if (err) txt += `\n⚠️ Execución con erro: ${err.message || err}\n`;
  return enviarCorreo(subject, txt);
}