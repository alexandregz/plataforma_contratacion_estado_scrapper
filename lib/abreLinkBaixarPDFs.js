// para controlar aperturas de links con target="_blank"
const { getNewBrowserTab } = require('./getNewBrowserTab');

// para a descarga
const {createWriteStream} = require('node:fs');
const {pipeline} = require('node:stream');
const {promisify} = require('node:util');

// entra nunha nova venta por cada expediente e abre nunha nova venta cada PDF que atopa, descargándoo
async function abreLinkBaixarPDFs(browser, page, table, concello) {
    console.log(" entrando en abreLinkBaixarPDFs...")

    // colho os links e vou clicando un a un.
    //    OLHO, o primeiro row ten 3 tags, polo que de tipo "a" hai dous pero "nth-child" hai 3 e só no primeiro  
    const links = await page.$$('#tableLicitacionesPerfilContratante > tbody > tr > td.tdExpediente > a:nth-of-type(2)');
    await links[0].evaluate(b => b.click());

    // Wait for new tab and return a page instance
    const newPage = await getNewBrowserTab(browser)
    console.log("  aberto link")

    // baixamos PDFs
    const linksPDFs = await newPage.$$("text/Pdf");
    console.log("    --- ---- ----- ")

    for(let i=0; i<linksPDFs.length; i++) {
        // const href = await links[0].evaluate(b => b.href);
        // console.log("    accedendo a " + href)

        await linksPDFs[i].evaluate(b => b.click());

        // Wait for new tab and return a page instance
        const newPagePDFs = await getNewBrowserTab(browser)
        await new Promise(resolve => setTimeout(resolve, 1000)) // agardo un segundo a que faga o redirect para o pdf
        // console.log("  newPagePDFs.url(): " + newPagePDFs.url());

        const fileName = newPagePDFs.url().substring(newPagePDFs.url().lastIndexOf('/') + 1, newPagePDFs.url().lastIndexOf('?')) 
        console.log("   fileName: " +  fileName  );

        await ( async () => {
            // console.log("    url"+i+": " + newPagePDFs.url())
            const response = await fetch( newPagePDFs.url() )

            // Prepare streamline
            const streamPipeline = promisify( pipeline )
            console.log("descarga en " + `PDF/${concello}/${table}/${fileName}`)
            const writeStream = createWriteStream( `PDF/${concello}/${table}/${fileName}`  )

            // gardar en disco
            streamPipeline( response.body, writeStream )
        })();

        await newPagePDFs.close();
    }

    await newPage.close();
}


module.exports = { abreLinkBaixarPDFs };