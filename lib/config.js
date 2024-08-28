const { readFileSync } = require('fs');

// ler config
const configStr = readFileSync('./' + process.argv[2]);
const CONFIG = JSON.parse(configStr);

module.exports = { CONFIG };