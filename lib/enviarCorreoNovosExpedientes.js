/**
 * Importante engadir '"type": "module",' a package.json, porque emailjs forza a empregalo como un módulo ECMAScript, non CommonJS
 */
import { SMTPClient } from 'emailjs';


// recibe array de obxectos ({Expediente:"xxxx",...}) cos novos expedientes (ver .all de bun:sqlite)
export function enviarCorreoNovosExpedientes(novosExpedientes) {

    // auth de smtp, ver exemplo*.json
    const CONFIG = require('../email_config.json');
    const FIELDS = require('../email_campos_envio.json');

    const today = new Date().toISOString().slice(0, 10);

    const txt = "novosExpedientes: " + novosExpedientes.toString() + ".....";
    

    FIELDS.text = "proba de envio :\n\n" + txt;
    FIELDS.subject = 'Scrapper Plataforma Contratación Estado ' + today;

    const client = new SMTPClient(CONFIG);

    return new Promise((resolve, reject) => {
        client.send(
            FIELDS,
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