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
    // IMPORTANTE: url_portal vai primeiro, fecha_insercion vai de última
    // Usamos unha copia para non alterar o array 'headers' orixinal
    const columnas = [...values, "url_portal", "fecha_insercion"];

    let values2 = columnas.map(w => w.toString().replace(/ /g, "_") + " TEXT").join();
    values2 = values2.replace(",", " PRIMARY KEY,");

    const stmt = DB.prepare(`CREATE TABLE IF NOT EXISTS ${table} (${values2})`);
    stmt.run();
}

// inserta en taboa
function insertIntoTable(table, headers, values) {
  // 1. Xeramos os nomes das columnas (limpando espazos)
  // Non incluímos aquí 'fecha_insercion' porque ese valor xérao SQLite con datetime()
  const columnNames = [
    ...headers.map(h => String(h || 'campo').replace(/ /g, "_")),
    "url_portal"
  ];

  // 2. Normalizamos valores comprobando o nome da columna correspondente ao índice
  const fixedValues = values.map((v, i) => {
    const nomeColumna = columnNames[i];

    // Se o campo é a url, saltamos a normalización (borra puntos, por exemplo)
    if (nomeColumna === "url_portal") {
      return v;
    }

    return normalizeEuroValue(v);
  });

  // 3. Preparamos o SQL. Aquí si engadimos 'fecha_insercion' aos nomes das columnas
  const sqlColumnNames = [...columnNames, "fecha_insercion"];
  const placeholders = fixedValues.map(() => '?').join(',');

  const sql = `INSERT INTO ${table} (${sqlColumnNames.join(',')}) VALUES (${placeholders}, datetime('now', 'localtime'))`;

  const stmt = DB.prepare(sql);

  try {
    stmt.run(fixedValues);
  } catch (e) {
    console.log(`❌ Erro insertando en ${table}: ${e.message}`);
  }
}


// comproba se existe o rexistro. Para iso so comprobamos o primeiro campo, pois debería ser único (debería ser "Expediente")
function existsRecord(table, headers, values) {
    const row = DB.prepare(`SELECT * FROM ${table} WHERE ${headers[0]} = ?`).get(values[0]);
    if(row == undefined) {
        return false;
    }
    return true; // booleano estrito true/false
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



function normalizeEuroValue(val) {
  if (typeof val !== "string") return val;
  let s = val.trim();

  // Se non contén ningunha coma nin punto, devolvemos igual
  if (!/[.,]/.test(s)) return s;

  // Caso con ambos: coma e punto
  if (s.includes(",") && s.includes(".")) {
    // Se a última coma está despois do último punto -> coma decimal (xa correcto)
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // xa formato europeo, quitamos puntos de milleiro
      s = s.replace(/\./g, "");
    } else {
      // formato inglés -> quitar comas de milleiro e cambiar punto por coma
      s = s.replace(/,/g, "").replace(/\./g, ",");
    }
  } else if (s.includes(",")) {
    // só comas -> se ten dúas cifras despois, coma decimal -> cambiar por punto decimal?
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      // formato europeo correcto, deixamos
      s = s.replace(/\./g, "");
    } else {
      // as comas son milleiros
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(".")) {
    // só puntos
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length === 2) {
      // inglés -> cambiar punto decimal a coma
      s = s.replace(/\./g, ",");
    } else {
      // puntos de milleiro
      s = s.replace(/\./g, "");
    }
  }

  return s;
}


// Engade isto en sqliteAccions.js para parchear a táboa existente
function patchTable(table) {
    try {
        DB.run(`ALTER TABLE ${table} ADD COLUMN url_portal TEXT`);
        console.log(`✅ Columna url_portal engadida á táboa ${table}`);
    } catch (e) {
        // Se xa existe, dará erro, pero non nos importa
    }
}



// total de rexistros dunha táboa (para saber se xa ten histórico antes de detectar fallos silenciosos)
function totalRowsInTable(table) {
    try {
        const row = DB.prepare(`SELECT COUNT(*) as n FROM ${table}`).get();
        return row ? row.n : 0;
    } catch (e) {
        // táboa inexistente
        return 0;
    }
}


// --- Dedup de correos notificados (evita reenviar o mesmo expediente ao re-executar o mesmo día).

// Táboa única global que rexistra que expedientes xa foron notificados por email (por táboa).
function createEmailEnviados() {
    DB.run(`CREATE TABLE IF NOT EXISTS email_enviados (
        taboa TEXT,
        expediente TEXT,
        enviado_en TEXT,
        PRIMARY KEY (taboa, expediente)
    )`);
}

// Devolve o array de expedientes xa notificados para unha táboa.
function expedientesXaEnviados(table) {
    createEmailEnviados();
    const rows = DB.query(`SELECT expediente FROM email_enviados WHERE taboa = ?1`).all(table);
    return rows.map(r => r.expediente);
}

// Marca un conxunto de expedientes como xa notificados para unha táboa.
function marcarExpedientesEnviados(table, expedientes) {
    createEmailEnviados();
    const stmt = DB.prepare(`INSERT OR IGNORE INTO email_enviados (taboa, expediente, enviado_en) VALUES (?, ?, datetime('now', 'localtime'))`);
    for (const exp of expedientes) {
        stmt.run(table, exp);
    }
}


module.exports = {
    loadDB, createTable, insertIntoTable, existsRecord,
    getAllIDsfromEntityBetweenDates, getTotalFilesFromExpediente, patchTable,
    totalRowsInTable, normalizeEuroValue,
    createEmailEnviados, expedientesXaEnviados, marcarExpedientesEnviados,
};