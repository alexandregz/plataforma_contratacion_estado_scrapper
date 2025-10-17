// uso:
// await baixaLinkPDF2(browser, table, el, ruta, dataPDFs[i], url);

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');
const streamPipeline = promisify(pipeline);

// se xa usas isto noutros sitios:
const { insertIntoTable } = require('./sqliteAccions'); // axusta a ruta se fai falta

// resolver filename desde Content-Disposition (soporta filename* e filename)
function resolveFilenameFromCD(cdHeader) {
  if (!cdHeader) return null;
  // RFC 5987: filename*=UTF-8''....
  let m = cdHeader.match(/filename\*=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (!m) {
    // clásico: filename="..."
    m = cdHeader.match(/filename="?([^"';]+)"?/i);
  }
  if (m && m[1]) {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }
  return null;
}

// sanea nome de ficheiro para non romper o FS
function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();
}

/**
 * Descarga un PDF dende a URL (do servlet) e gárdao en `ruta`.
 * Logo inserta o rexistro en `${table}_files`.
 *
 * @param {import('puppeteer').Browser} browser   // (non se usa aquí, pero mantemos a sinatura)
 * @param {string} table
 * @param {Array|string[]} el        // p.ex. [expediente, ...] → empregamos el[0] como id
 * @param {string} ruta              // directorio destino
 * @param {Array|string[]} dataPDFs  // p.ex. [dataPublicación, tipoDocumento]
 * @param {string} url               // URL directa do PDF (GetDocumentByIdServlet)
 */
async function baixaLinkPDF2(browser, table, el, ruta, dataPDFs, url) {
  if (!url) throw new Error('baixaLinkPDF2: falta URL');
  if (!el || !el[0]) throw new Error('baixaLinkPDF2: falta identificador en el[0]');

  // asegúrate de que existe o directorio
  fs.mkdirSync(ruta, { recursive: true });

  // nome provisional por se o servidor non achega filename
  let fileName =
    sanitizeName(String(el[0]).replace(/\//g, '_')) +
    '_' +
    Math.random().toString(36).slice(2, 8) +
    '.pdf';

  // usa o fetch global (Node 18+/Bun). Se non existise, instala node-fetch e importa aquí.
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status} ao descargar: ${url}`);
  }

  // le headers
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const cd = response.headers.get('content-disposition') || '';

  // resolve filename se o servidor o fornece
  const cdName = resolveFilenameFromCD(cd);
  if (cdName) fileName = sanitizeName(cdName);

  if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';

  // aviso se non é application/pdf (algúns servidores mandan visor/HTML)
  if (!/application\/pdf/i.test(contentType)) {
    console.warn('⚠️ content-type non é application/pdf:', contentType, '— gardarei igualmente.');
  }

  const outPath = path.join(ruta, fileName);

  // evita duplicados
  if (fs.existsSync(outPath)) {
    console.log('   (xa existía) ', outPath);
  } else {
    // garda binario
    await streamPipeline(response.body, fs.createWriteStream(outPath));
    console.log('   ✅ PDF gardado en:', outPath);
  }

  // inserta en BD: [nomeFicheiro, expediente(el[0]), tipoDocumento, dataPublicacion]
  // adapta a orde se no teu esquema é distinta
  try {
    insertIntoTable(`${table}_files`, [fileName, el[0], dataPDFs?.[1] ?? '', dataPDFs?.[0] ?? '']);
  } catch (e) {
    console.warn('⚠️ Non se puido inserir en BD:', e?.message || e);
  }

  return outPath;
}

module.exports = { baixaLinkPDF2 };
