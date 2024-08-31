// para controlar aperturas de links con target="_blank"
const { getNewBrowserTab } = require('./getNewBrowserTab');

// para a descarga
const {createWriteStream, existsSync} = require('node:fs');
const {pipeline} = require('node:stream');
const {promisify} = require('node:util');

// insertar ficheiros en "taboa"_files
const { insertIntoTable } = require('./sqliteAccions');

// entra nunha nova venta por cada expediente e abre nunha nova venta cada PDF que atopa, descargándoo
async function baixaLinkPDF(browser, table, el, ruta, dataPDFs) {
    console.log(" entrando en baixaLinkPDF...")

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
            }
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

    // insertamos en BD xxxx_files
    insertIntoTable(table+'_files', [fileName, el[0], dataPDFs[1], dataPDFs[0]])

    await newPagePDFs.close();
    console.log("  pechada nova tab (PDFs)\n   --- ---")
}


module.exports = { baixaLinkPDF };