// melhor que sqlite3, sincrona e máis rápida que better-sqlite3
const { Database } = require('bun:sqlite');

var DB;

// devolve "db" (const)
function loadDB(nome_db) {
    const dbPath = './' +nome_db+ '.db'

    DB = new Database(dbPath);
    // return new Database(dbPath, { verbose: console.log });
}

// crea DB
//      engado un campo mais, non so os "headers" extraidos da web, para engadir a data na que se inserta o expediente
function createDB(table, values) {
    values.push("fecha_insercion");

    const values2 = values.map(w => w.toString().replace(/ /g, "_") + " TEXT").join();

    const stmt = DB.prepare(`CREATE TABLE IF NOT EXISTS ${table} (${values2})`);
    stmt.run();
}

function insertDB(table, values) {
    const stmt = DB.prepare(`INSERT INTO ${table} VALUES (` +values.map(word => '?').join()+ `, datetime('now', 'localtime'))`);
    stmt.run(values);
    //console.log(stmt.toString())
}

// comproba se existe o rexistro. Para iso so comprobamos o primeiro campo, pois debería ser único (debería ser "Expediente")
function existsRecord(table, headers, values) {
    const row = DB.prepare(`SELECT * FROM ${table} WHERE ${headers[0]} = ?`).get(values[0]);
    if(row == undefined) {
        return false;
    }
}

// devolve todos os "IDs" (o primeiro tipo, Expediente) de cada tipo. Para poder comprobar os cambios que houbo en cada entidade
function getAllIDsfromEntity(table, headers) {
    const query = db.query(`SELECT $id FROM ${table};`);
    return query.all({ $id: headers[0] }).values();
}

module.exports = { loadDB, createDB, insertDB, existsRecord, getAllIDsfromEntity };