/**
 * envio email (para envio a posteriori: test, debug, etc.)
 * 
 * Usage: $ bun envio_email.js nome_db taboa
 *    exemplo: $ bun envio_email.js ames_skipped_test|ames|san_cibrao_das_vinhas Alcaldia_licitacions|Alcaldia_contratos_menores
 */
const { loadDB, getAllIDsfromEntityBetweenDates } = require('./lib/sqliteAccions');
const { enviarCorreoNovosExpedientes } = require('./lib/enviarCorreoNovosExpedientes');

// --- uso
function usage() {
    console.log('Uso: '+process.argv[0]+' '+process.argv[1]+' NOME_DB TABLE')
    process.exit(0);
}
if(!process.argv[3]) {
    usage()
}

const name_db = process.argv[2]
const table_db = process.argv[3]

// cargar db
loadDB(name_db)

// comezo fluxo
console.log("Enviando email forzado (cos resultados do dia de hoxe)")

try {
    const response = await enviarCorreoNovosExpedientes(name_db, table_db);
    //console.log('Email sent successfully:', response);
    console.log('Informe de cambios enviado correctamente');
} catch (err) {
    console.error('Failed to send email:', err);
}

