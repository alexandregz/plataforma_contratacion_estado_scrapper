/**
 * Importante engadir '"type": "module",' a package.json, porque emailjs forza a empregalo como un módulo ECMAScript, non CommonJS
 */
import { SMTPClient } from 'emailjs';

// non facemos o loadDB aqui porque o nome da BD pode ser recolhido programaticamente por parametro e é mais doado empregala no .js principal
const { getAllIDsfromEntityBetweenDates, expedientesXaEnviados, marcarExpedientesEnviados } = require('./sqliteAccions');

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

// recibe array de obxectos ({Expediente:"xxxx",...}) cos novos expedientes (ver .all de bun:sqlite)
export function enviarCorreoNovosExpedientes(concello, table, data) {
  let today = new Date().toISOString().slice(0, 10);
  if (data) {
    today = new Date(data).toISOString().slice(0, 10);
  }

  const tenDaysMore = new Date(new Date(today).setDate(new Date().getDate() + 1)).toISOString().slice(0, 10);
  const novosExpedientes = getAllIDsfromEntityBetweenDates(table, today, tenDaysMore) || [];

  // Dedup de correos: só se envían os expedientes que AÍNDA non foron notificados (email_enviados).
  // Así, re-executar o mesmo día non reenvía o mesmo correo.
  const xaEnviados = new Set(expedientesXaEnviados(table));
  const porNotificar = novosExpedientes.filter(o => {
    const id = idExpediente(o);
    return id != null && !xaEnviados.has(id);
  });

  // NON se envía email se non hai expedientes novos por notificar nesta entidade+tipo de contrato
  if (porNotificar.length === 0) {
    console.log(` 📭 Non hai novos expedientes por notificar en ${table} para o ${today}: non se envía email.`);
    return null;
  }

  const subject = `Scrapper plat. contrat. Estado ${today} ${concello} ${table}`;
  let txt = `${subject}\n\n`;

  // array de objects tipo { Expediente: "xxxx" }
  txt += `Novos Expedientes ${today}:\n\n`;
  porNotificar.forEach(o => {
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
    // Só marcamos como notificados cando o envío foi REAL (res truthy).
    // Se se omitiu por non haber email configurado (null) NON se marca, para non perder envíos futuros.
    if (res) {
      const ids = porNotificar.map(idExpediente).filter(x => x != null);
      marcarExpedientesEnviados(table, ids);
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