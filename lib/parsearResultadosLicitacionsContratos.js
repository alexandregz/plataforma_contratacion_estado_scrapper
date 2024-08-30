// no mesmo directorio
//      non facemos o loadDB aqui porque o nome da BD pode ser recolhido programaticamente por parametro e é mais doado empregala no .js principal
import { createTable, insertIntoTable, existsRecord }  from './sqliteAccions.js';

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

    // se non hai headers, non hai resultados
    if(headers.length > 0) {
        console.log("creando taboa " +table+ "...")
        createTable(table, headers)

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

                // se o rexistro existe en BD, saimos de todo o proceso de insert+download. Para forzar o baixado de PDFs hai que borrar os rexistros no .db
                if(existsRecord(table, headers, el) === false) {
                    // 1) primeiro inserto en DB
                    insertIntoTable(table, el)

                    //   NOTA: non podo extraelo porque por asincronicidade abre todos os links (?)
                    // 2) despois abro o link en con target_blank e baixo os PDFs
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
                
                    for(let n=0; n<linksPDFs.length; n++) {
                        // const href = await links[0].evaluate(b => b.href);
                        // console.log("    accedendo a " + href)
                
                        await linksPDFs[n].evaluate(b => b.click());
                
                        // Wait for new tab and return a page instance
                        const newPagePDFs = await getNewBrowserTab(browser)

                        // ---- nome de ficheiro
                        // nome temporal con substring aleatorio, o real ímolo quitar do header "Content-Disposition: inline;filename=xxxxx.pdf"
                        let fileName = el[0].replace(/\//g, "_") + Math.random().toString(36).substring(7)

                        // lemos a resposta para extraer o nome do ficheiro da cabeceira Content-Disposition
                        //   (casualmente, desde o luns seguinte a ter rematado o scrapper, o servlet que sirve o pdf non muda a url e hai que extraela do header)
                        newPagePDFs.on('response', async (response) => {
                            // Check if the response contains the Content-Disposition header
                            const contentDisposition = response.headers()['content-disposition'];
                            
                            if (contentDisposition) {
                                // Check if it is inline and contains a filename
                                const matches = contentDisposition.match(/inline;\s*filename=("')?(.+)("')?/i);;
                                if (matches && matches[2]) {
                                    fileName = matches[2];
                                    // console.log('newPagePDFs Found filename:', filename);
                                }
                                // else {
                                //     console.log('newPagePDFs Content-Disposition does not contain an inline filename');
                                // }
                            }
                        });
                        
                        // desde o 2024-08-26, o servlet non fai redirect con "meta http-equiv" (?)
                        //   Se mantemos este timeout dun segundo si que colhe ben o filename
                        await new Promise(resolve => setTimeout(resolve, 1000)) // agardo un segundo a que faga o redirect para o pdf
                
                        if (!existsSync(`${ruta}/${fileName}`)) {
                            await ( async () => {
                                console.log("    fileName: " +  fileName  );
                                console.log("    url"+i+": " + newPagePDFs.url())
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