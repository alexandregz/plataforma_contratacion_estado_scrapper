/**
 * Importante engadir '"type": "module",' a package.json, porque emailjs forza a empregalo como un módulo ECMAScript, non CommonJS
 */
import { SMTPClient } from 'emailjs';

// non facemos o loadDB aqui porque o nome da BD pode ser recolhido programaticamente por parametro e é mais doado empregala no .js principal
import { getAllIDsfromEntityBetweenDates } from './sqliteAccions.js';

// ler config
import { CONFIG }  from './config.js';

// recibe array de obxectos ({Expediente:"xxxx",...}) cos novos expedientes (ver .all de bun:sqlite)
export function enviarCorreoNovosExpedientes(concello, table, data) {
    let today = new Date().toISOString().slice(0, 10);
    if(data) {
        today = new Date(data).toISOString().slice(0, 10);
    }    
    const tenDaysMore = new Date(new Date(today).setDate(new Date().getDate()+1)).toISOString().slice(0, 10);
    const novosExpedientes = getAllIDsfromEntityBetweenDates(table, today, tenDaysMore)
    
    // para que sexa igual que subject coloco asi FIELDS
    let txt = "Scrapper plat. contrat. Estado " + today + " " + concello + " " + table ;
    CONFIG.EMAIL_CAMPOS_ENVIO.subject = txt;
    txt += "\n\n";

    // array de objects tipo { Expediente: "xxxx" }
    txt += `Novos Expedientes ${today}:\n\n`;
    novosExpedientes.forEach(o => {
        Object.keys(o).forEach((k) => {
            let value = o[k];
            if(k == 'Estado') value = value.replace(/(\r\n|\r|\n)/g, '\n\t')    // en Estado hai texto multilinea

            if(k != 'fecha_insercion') txt += `\t ${k}: ${value}\n`;
        });
        txt += "\n";
    });
    CONFIG.EMAIL_CAMPOS_ENVIO.text = txt;
    
    // console.log(txt)
    // process.exit(0)

    // envio email
    const client = new SMTPClient(CONFIG.EMAIL_CONFIG);

    return new Promise((resolve, reject) => {
        client.send(
            CONFIG.EMAIL_CAMPOS_ENVIO,
            (err, message) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(message);
                }
            }
        );
    });
}