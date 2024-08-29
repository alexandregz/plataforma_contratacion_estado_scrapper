import { readFileSync } from 'fs';

// ler config
const configStr = readFileSync('./' + process.argv[2]);
export const CONFIG = JSON.parse(configStr);
