// no mesmo directorio
//      non facemos o loadDB aqui porque o nome da BD pode ser recolhido programaticamente por parametro e é mais doado empregala no .js principal
const { createTable, insertIntoTable, existsRecord, getTotalFilesFromExpediente, patchTable } = require('./sqliteAccions');

// para controlar aperturas de links con target="_blank"
const { getNewBrowserTab } = require('./getNewBrowserTab');

// raiz, á altura do js inicial
const directorioPDF = 'PDF';
// crea path a PDFs
const { creaRutaNonExiste } = require('./creaRutaNonExiste');

// envio informe novos expedientes
const { enviarCorreoNovosExpedientes } = require('./enviarCorreoNovosExpedientes');

// ler config
const { CONFIG } = require('./config.js');

// apertura de PDFs e baixada de ficheiros
const { baixaLinkPDF2 } = require('./baixaLinkPDF2');


// codigo que recorre os resultados en "licitacions" e "contratos menores"
//    inserta en sqlite, polo que necesita importar os metodos de bun:sqlite creados
//
// Devolve un resumo do estado da táboa tratada: { table, encontrada, tenResultados, url }.
// O driver principal úsao para detectar fallos silenciosos (táboa esperada sen resultados).
async function parsearResultadosLicitacionsContratos(browser, page, table, concello, entidade) {
  // Replace '#yourElementId' with the ID you are checking
  const elementHandle = await page.$('#tableLicitacionesPerfilContratante');
  const resumoDoProceso = { table, encontrada: !!elementHandle, tenResultados: false, url: (CONFIG.ENTIDADES[entidade] || {}).url || '' };

  if (elementHandle) {
    // -- CABECEIRAS
    const headers = await page.$$eval("#tableLicitacionesPerfilContratante > thead > tr > th", rows =>
      rows.map(row =>
        [...row.querySelectorAll("div > strong")].map(cell => cell.innerText.trim())
      )
    );

    // se non hai headers, non hai resultados, polo que non hai que percorrer nada
    if (headers.length > 0) {
      console.log("  creando taboa " + table + "...")
      resumoDoProceso.tenResultados = true;
      createTable(table, headers)
      // campos: expediente, filename,
      const headersFiles = ["filename", headers[0], "tipo", "fecha_publicacion"];  // `${table}_files` para gardar ficheiros
      createTable(table + '_files', headersFiles)
      // taboas `_files` antigas non teñen a columna url_portal (engadida no commit que cambiou insertIntoTable)
      patchTable(table + '_files')


      // -- DATA
      let isLastPage = false;

      let contadorPaxinas = 0;

      while (!isLastPage) {
        // Extract the data from the current page
        const pageData = await page.$$eval("#tableLicitacionesPerfilContratante > tbody > tr", rows =>
          rows.map(row =>
            [...row.querySelectorAll("td")].map(cell => cell.innerText.trim())
          )
        );
        // isLastPage = true;

        console.log("  insertamos rexistros en " + table + "...")

        // Fronteira por existencia: conta cantos expedientes desta páxina son novos (non estaban na BD).
        // Cando unha páxina enteira xa está toda coñecida (0 novos) chegamos á fronteira e paramos.
        let novosNestaPaxina = 0;

        //
        for (i = 0; i < pageData.length; i++) {
          const el = pageData[i];
          console.log("  pageData.el " + i + " a comprobar e descargar PDFs")

          // 1. Comprobamos se xa existe ANTES de facer nada
          const isNew = existsRecord(table, headers, el) === false;
          if (isNew) novosNestaPaxina++;

          // 2. Abrimos a nova pestana (necesitamos facelo igual para os PDFs)
          // colho os links e vou clicando un a un.
          //    OLHO, o primeiro row ten 3 tags, polo que de tipo "a" hai dous pero "nth-child" hai 3 e só no primeiro
          const links = await page.$$('#tableLicitacionesPerfilContratante > tbody > tr > td.tdExpediente > a:nth-of-type(2)');
          await links[i].evaluate(b => b.click());

          // Wait for new tab and return a page instance
          const newPage = await getNewBrowserTab(browser);
          const currentUrl = newPage.url();
          console.log("   aberto link: " + currentUrl);

          // 3. Se o rexistro é novo, insertámolo agora que xa temos a URL
          if (isNew) {
            const datosConUrl = [...el, currentUrl];
            patchTable(table);

            // CAMBIO: Engadimos 'headers' como segundo argumento
            insertIntoTable(table, headers, datosConUrl);
          }


          // el[0] e o expediente
          const ruta = `${directorioPDF}/${concello}/${table}/` + el[0].replace(/\//g, "_")   // hai expedientes con varias "/"
          creaRutaNonExiste(ruta)

          // ---- baixamos PDFs
          // 1) Colle as URLs dos PDF
          const linksPDFs = await newPage.$$eval('#myTablaDetalleVISUOE a', as =>
            as
              .filter(a => {
                const img = a.querySelector('img[alt]');
                return (
                  img &&
                  img.getAttribute('alt') &&
                  img.getAttribute('alt').toLowerCase().includes('documento pdf')
                );
              })
              .map(a => new URL(a.href, location.href).href) // asegura URL absoluta
          );
          // console.log('🔗 Links PDF atopados:', linksPDFs);


          // para non cargar mais o site, se  o numero de links a insertar coincide cos que temos en BD, non abrimos todos e seguimos,
          // intuindo que xa están todos baixados
          // 2) Se non hai que baixar (comparación con BD)
          console.log(`       comprobando expedientes en taboa ${table}_files de ` + el[0]);
          const total = getTotalFilesFromExpediente(table + '_files', el[0]);
          //console.log("         total rexistrados en BD: " + total);
          if (total >= linksPDFs.length) {
            console.log(`        > non fai falta baixar PDFs total: [${total}] - linksPDFs.length: [${linksPDFs.length}]`);
          } else {
            console.log("        baixando PDFs... ");

            // OJO: Se os datos están na mesma páxina, usa "page" en vez de "newPage"
            const dataPDFs = await newPage.$$eval("#myTablaDetalleVISUOE > tbody > tr", rows =>
              rows.map(row =>
                [...row.querySelectorAll("td:nth-child(1), td:nth-child(2)")].map(cell => cell.innerText.trim())
              )
            );

            // 3) Recorre URLs (declara o índice!)
            for (let j = 0; j < linksPDFs.length; j++) {
              const url = linksPDFs[j];
              // console.log("url PDF: " + url)
              // Se a túa función descarga a partir da URL, pásalla
              await baixaLinkPDF2(browser, table, el, ruta, dataPDFs[j], url, headersFiles);
            }
          }
          await newPage.close();

        }

        // Fronteira por existencia: se a páxina enteira xa estaba na BD, non hai nada novo máis alá → paramos.
        // (En orde de páxinas novo→vello, unha páxina toda coñecida implica que o resto tamén o está.)
        if (pageData.length > 0 && novosNestaPaxina === 0) {
          console.log("   ⏹️  " + table + ": páxina toda xa coñecida, paramos na fronteira")
          isLastPage = true;
          break;
        }

        // comprobo se hai link de seguinte
        const nextButton = await page.$$('table[id="tableLicitacionesPerfilContratante"] > tfoot > tr > td > div > input[id$="siguienteLink"]');
        if (nextButton.length > 0) {
          console.log("   ➡️   nova paxina atopada, saltamos... (paxina " + (++contadorPaxinas) + ")")
          await Promise.all([
            page.click('table[id="tableLicitacionesPerfilContratante"] > tfoot > tr > td > div > input[id$="siguienteLink"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0' }), // Wait for the new page to load
          ]);
        } else {
          isLastPage = true;
        }

        // se chegamos ao limite por config, marcamos como isLastPage para sair do bucle
        if (CONFIG.ENTIDADES[entidade].limite_paxinas) {
          if (contadorPaxinas >= CONFIG.ENTIDADES[entidade].limite_paxinas) {
            console.log("     ⏭️  por limite (" + CONFIG.ENTIDADES[entidade].limite_paxinas + "), saltamos de paxina (entidade: " + entidade + ")")
            isLastPage = true;

            break;
          }
        }
      }

      // en lugar de recolher os cambios cando se fai o insertIntoTable porque non existe "record" (existsRecord = false), facemolo aqui cun resumo, comprobando
      // a data de insercion. Isto é porque así podemos parar o proceso en calquera momento e continuar, en lugar de ter que recrealo "limpo" para ter resultados
      // axeitados
      console.log("Enviando informe de cambios para " + table)

      try {
        const response = await enviarCorreoNovosExpedientes(concello, table);
        //console.log('Email sent successfully:', response);
        console.log(' 📩 Informe de cambios enviado correctamente');
      } catch (err) {
        console.error('Failed to send email:', err);
      }
    }

    console.log("------------------- -------------------")
  } else {
    resumoDoProceso.encontrada = false;
    console.log(" == non existe #tableLicitacionesPerfilContratante, non hai resultados... ");
  }

  return resumoDoProceso;
}

module.exports = { parsearResultadosLicitacionsContratos };