// melhor que sqlite3, sincrona e máis rápida que better-sqlite3
const { Database } = require('bun:sqlite');

var DB;

// devolve "db" (const)
function loadDB(nome_db) {
    const dbPath = './' +nome_db+ '.db'

    DB = new Database(dbPath);
}

// crea taboa
//      engado un campo mais, non so os "headers" extraidos da web, para engadir a data na que se inserta o expediente
function createTable(table, values) {
    values.push("fecha_insercion");

    // o primeiro campo vouno convertir en PRIMARY KEY, facendo un replace sen ser global via regexp vaino facer so unha vez
    let values2 = values.map(w => w.toString().replace(/ /g, "_") + " TEXT").join();
    values2 = values2.replace(",", " PRIMARY KEY,")
    // console.log(values2)

    const stmt = DB.prepare(`CREATE TABLE IF NOT EXISTS ${table} (${values2})`);
    stmt.run();
}

function insertIntoTable(table, values) {
    const stmt = DB.prepare(`INSERT INTO ${table} VALUES (` +values.map(word => '?').join()+ `, datetime('now', 'localtime'))`);
    stmt.run(values);
    // console.log(stmt.toString())
}

// comproba se existe o rexistro. Para iso so comprobamos o primeiro campo, pois debería ser único (debería ser "Expediente")
function existsRecord(table, headers, values) {
    const row = DB.prepare(`SELECT * FROM ${table} WHERE ${headers[0]} = ?`).get(values[0]);
    if(row == undefined) {
        return false;
    }
}

// devolve todos os "IDs" (o primeiro tipo, Expediente) de cada tipo. Para poder comprobar os cambios que houbo en cada entidades
//      data_comezo e data_fin poden ter calquera formato, preferiblemente YYYY-MM-DD (dia de hoxe e un dia no futuro suficientemente lonxano, por exemplo)
function getAllIDsfromEntityBetweenDates(table, data_comezo, data_fin) {
    const query = DB.query(`SELECT * FROM ${table} WHERE date(fecha_insercion) BETWEEN date(?1) AND date(?2);`);
    const values = query.all(data_comezo, data_fin);
    query.finalize();

    return values;
}


// total de ar
//      data_comezo e data_fin poden ter calquera formato, preferiblemente YYYY-MM-DD (dia de hoxe e un dia no futuro suficientemente lonxano, por exemplo)
function getTotalFilesFromExpediente(table, expediente) {
    const query = DB.prepare(`SELECT COUNT(*) FROM ${table} WHERE Expediente = ?1;`).get(expediente);
    if(!query) return 0;

    return query['COUNT(*)'];
}


module.exports = { loadDB, createTable, insertIntoTable, existsRecord, getAllIDsfromEntityBetweenDates, getTotalFilesFromExpediente };