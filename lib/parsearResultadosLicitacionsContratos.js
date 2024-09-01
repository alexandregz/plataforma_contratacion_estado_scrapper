// no mesmo directorio
//      non facemos o loadDB aqui porque o nome da BD pode ser recolhido programaticamente por parametro e é mais doado empregala no .js principal
import { createTable, insertIntoTable, existsRecord, getTotalFilesFromExpediente }  from './sqliteAccions.js';
// para controlar aperturas de links con target="_blank"
import { getNewBrowserTab }  from './getNewBrowserTab.js';

// para a descarga
import {createWriteStream, existsSync}  from 'node:fs';
import {pipeline}  from 'node:stream';
import {promisify}  from 'node:util';

// crea path a PDFs
import { creaRutaNonExiste }  from './creaRutaNonExiste.js';

// envio informe novos expedientes
import { enviarCorreoNovosExpedientes }  from './enviarCorreoNovosExpedientes.js';

// ler config
import { CONFIG }  from './config.js';
import { baixaLinkPDF } from './baixaLinkPDF.js';


// raiz, á altura do js inicial
const directorioPDF = 'PDF';


// codigo que recorre os resultados en "licitacions" e "contratos menores"
//    inserta en sqlite, polo que necesita importar os metodos de bun:sqlite creados
export async function parsearResultadosLicitacionsContratos(browser, page, table, concello, entidade) {
    // -- CABECEIRAS
    const headers = await page.$$eval("#tableLicitacionesPerfilContratante > thead > tr > th", rows => 
        rows.map(row =>
            [...row.querySelectorAll("div > span")].map(cell => cell.innerText.trim())
        )
    );

    // se non hai headers, non hai resultados, polo que non hai que percorrer nada
    if(headers.length > 0) {
        console.log("creando taboa " +table+ "...")
        createTable(table, headers)
        createTable(table + '_files', ["filename", headers[0], "tipo", "fecha_publicacion"])  // `${table}_files` para gardar ficheiros



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

            console.log("insertamos rexistros en " +table+ "...")

            //
            for(let i=0; i<pageData.length; i++) {
                const el = pageData[i];
                console.log(" pageData.el "+i+" a comprobar e descargar PDFs")

                // inserto rexistro en BD
                if(existsRecord(table, headers, el) === false) {
                    insertIntoTable(table, el)
                }

                //   NOTA: non podo extraer o código porque por asincronicidade abre todos os links (?)
                // Despois abro o link con target_blank e baixo os PDFs, revisando se non estan baixados previamente (estarían en BD insertados)
                console.log("  abrindo nova tab (PDFs)")

                // colho os links e vou clicando un a un.
                //    OLHO, o primeiro row ten 3 tags, polo que de tipo "a" hai dous pero "nth-child" hai 3 e só no primeiro  
                const links = await page.$$('#tableLicitacionesPerfilContratante > tbody > tr > td.tdExpediente > a:nth-of-type(2)');
                await links[i].evaluate(b => b.click());
            
                // Wait for new tab and return a page instance
                const newPage = await getNewBrowserTab(browser)
                console.log("  aberto link: " + newPage.url())
            

                // el[0] e o expediente
                const ruta = `${directorioPDF}/${concello}/${table}/` + el[0].replace(/\//g, "_")   // hai expedientes con varias "/"
                creaRutaNonExiste(ruta)
                                
                // baixamos PDFs
                const linksPDFs = await newPage.$$("text/Pdf");
                console.log("     num PDFs en paxina: " + linksPDFs.length)

                // para non cargar mais o site, se  o numero de links a insertar coincide cos que temos en BD, non abrimos todos e seguimos,
                // intuindo que xa están todos baixados
                console.log(`       comprobando expedientes en taboa ${table}_files de `+ el[0])
                const total = getTotalFilesFromExpediente(table + '_files', el[0])
                console.log("         total rexistrados en BD: " + total)
                if(total >= linksPDFs.length) {
                    console.log("        > non fai falta baixar PDFs " + `total: [${total}] - linksPDFs.length: [${linksPDFs.length}]`)
                }
                else {
                    console.log("        baixando PDFs... ")

                    // recolhemos textos para insertar en BD da paxina na que están os PDFs
                    const dataPDFs = await newPage.$$eval("#myTablaDetalleVISUOE > tbody > tr", rows => 
                        rows.map(row =>
                            [...row.querySelectorAll("td:nth-child(1), td:nth-child(2)")].map(cell => cell.innerText.trim())
                        )
                    );


                    // apertura de links e baixada de PDFs
                    for(let n=0; n<linksPDFs.length; n++) {
                        // const href = await links[0].evaluate(b => b.href);
                        // console.log("    accedendo a " + href)
                
                        await linksPDFs[n].evaluate(b => b.click());
                
                        await baixaLinkPDF(browser, table, el, ruta, dataPDFs[n])
                    }
                }

                await newPage.close();
                
            }

            // comprobo se hai link de seguinte
            const nextButton = await page.$$('table[id="tableLicitacionesPerfilContratante"] > tfoot > tr > td > input[id$=siguienteLink]');
            if(nextButton.length > 0) {
                console.log("  ======> nova paxina atopada, saltamos... (paxina " +(++contadorPaxinas)+ ")")
                await Promise.all([
                    page.click('table[id="tableLicitacionesPerfilContratante"] > tfoot > tr > td > input[id$=siguienteLink]'),
                    page.waitForNavigation({ waitUntil: 'networkidle0' }), // Wait for the new page to load
                ]);
            }
            else {
                isLastPage = true;
            }

            // se chegamos ao limite por config, marcamos como isLastPage para sair do bucle
            if(CONFIG.ENTIDADES[entidade].limite_paxinas) {
                if(contadorPaxinas >= CONFIG.ENTIDADES[entidade].limite_paxinas) {
                    console.log("  --> por limite ("+CONFIG.ENTIDADES[entidade].limite_paxinas+"), saltamos de paxina (entidade: "+entidade+")")
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
            console.log('Informe de cambios enviado correctamente');
        } catch (err) {
            //console.error('Failed to send email:', err);
            console.log("Erro enviando email!")
        }
    }

    console.log("-------------------")
}