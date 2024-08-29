import fs from 'node:fs';

export function creaRutaNonExiste(ruta) {
    // Check if the path exists
    if (!fs.existsSync(ruta)) {
        // Create the directory if it does not exist
        fs.mkdirSync(ruta, { recursive: true });

        // console.log(`Directory created: ${ruta}`);
    }
    // else {
    //     console.log(`Directory already exists: ${ruta}`);
    // }
}
