// no mesmo directorio
//      non facemos o loadDB aqui porque o nome da BD pode ser recolhido programaticamente por parametro e é mais doado empregala no .js principal
const { createDB, insertDB, existsRecord, getAllIDsfromEntity } = require('./sqliteAccions');

// para controlar aperturas de links con target="_blank"
const { getNewBrowserTab } = require('./getNewBrowserTab');

// para a descarga
const {createWriteStream, existsSync} = require('node:fs');
const {pipeline} = require('node:stream');
const {promisify} = require('node:util');

// raiz, á altura do js inicial
const directorioPDF = 'PDF';
// crea path a PDFs
const { creaRutaNonExiste } = require('./creaRutaNonExiste');



// codigo que recorre os resultados en "licitacions" e "contratos menores"
//    inserta en sqlite, polo que necesita importar os metodos de bun:sqlite creados
async function parsearResultadosLicitacionsContratos(browser, page, table, concello) {
    // -- CABECEIRAS
    const headers = await page.$$eval("#tableLicitacionesPerfilContratante > thead > tr > th", rows => 
        rows.map(row =>
            [...row.querySelectorAll("div > span")].map(cell => cell.innerText.trim())
        )
    );

    // se non hai headers, non hai resultados
    if(headers.length > 0) {
        console.log("creando taboa " +table+ "...")
        createDB(table, headers)

        // -- DATA
        let isLastPage = false;

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
            for(i=0; i<pageData.length; i++) {
                const el = pageData[i];
                console.log(" pageData.el "+i+" a comprobar e descargar PDFs")

                // se o rexistro existe en BD, saimos de todo o proceso de insert+download. Para forzar o baixado de PDFs hai que borrar os rexistros no .db
                if(existsRecord(table, headers, el) === false) {
                    // 1) primeiro inserto en DB
                    insertDB(table, el)

                    //   NOTA: non podo extraelo porque por asincronicidade abre todos os links (?)
                    // 2) despois abro o link en con target_blank e baixo os PDFs
                    console.log("  abrindo nova tab (PDFs)")

                    // colho os links e vou clicando un a un.
                    //    OLHO, o primeiro row ten 3 tags, polo que de tipo "a" hai dous pero "nth-child" hai 3 e só no primeiro  
                    const links = await page.$$('#tableLicitacionesPerfilContratante > tbody > tr > td.tdExpediente > a:nth-of-type(2)');
                    await links[i].evaluate(b => b.click());
                
                    // Wait for new tab and return a page instance
                    const newPage = await getNewBrowserTab(browser)
                    console.log("  aberto link")
                

                    // el[0] e o expediente
                    const ruta = `${directorioPDF}/${concello}/${table}/` + el[0].replace(/\//g, "_")   // hai expedientes con varias "/"
                    creaRutaNonExiste(ruta)
                                    
                    // baixamos PDFs
                    const linksPDFs = await newPage.$$("text/Pdf");
                    console.log("     num PDFs en paxina: " + linksPDFs.length)
                
                    for(n=0; n<linksPDFs.length; n++) {
                        // const href = await links[0].evaluate(b => b.href);
                        // console.log("    accedendo a " + href)
                
                        await linksPDFs[n].evaluate(b => b.click());
                
                        // Wait for new tab and return a page instance
                        const newPagePDFs = await getNewBrowserTab(browser)
                        await new Promise(resolve => setTimeout(resolve, 1000)) // agardo un segundo a que faga o redirect para o pdf
                        // console.log("  newPagePDFs.url(): " + newPagePDFs.url());
                
                        const fileName = newPagePDFs.url().substring(newPagePDFs.url().lastIndexOf('/') + 1, newPagePDFs.url().lastIndexOf('?')) 
                        console.log("    fileName: " +  fileName  );
                
                        if (!existsSync(`${ruta}/${fileName}`)) {
                            await ( async () => {
                                // console.log("    url"+i+": " + newPagePDFs.url())
                                const response = await fetch( newPagePDFs.url() )
                    
                                // Prepare streamline
                                const streamPipeline = promisify( pipeline )
                                console.log("     descarga en " + `${ruta}/${fileName}`)
                                const writeStream = createWriteStream( `${ruta}/${fileName}`  )
                    
                                // gardar en disco
                                streamPipeline( response.body, writeStream )
                            })();
                        }
                        else {
                            console.log("    xa existe " +  `${ruta}/${fileName}`  );
                        }
                
                        await newPagePDFs.close();
                        console.log("  pechada nova tab (PDFs)\n   --- ---")
                    }

                    await newPage.close();
                }
                
            }

            // comprobo se hai link de seguinte
            const nextButton = await page.$$('table[id="tableLicitacionesPerfilContratante"] > tfoot > tr > td > input[id$=siguienteLink]');
            if(nextButton.length > 0) {
                console.log("  ======> nova paxina atopada, saltamos...")
                await Promise.all([
                    page.click('table[id="tableLicitacionesPerfilContratante"] > tfoot > tr > td > input[id$=siguienteLink]'),
                    page.waitForNavigation({ waitUntil: 'networkidle0' }), // Wait for the new page to load
                ]);
            }
            else {
                isLastPage = true;
            }
        }
    }
    console.log("-------------------")
}

module.exports = { parsearResultadosLicitacionsContratos };
