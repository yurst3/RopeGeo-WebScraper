/**
 * Registers Node to load .txt files as UTF-8 string module.exports.
 * Used by local ts-node scripts that import legendContextModelSystemPrompt.txt.
 *
 * Usage: node -r ./scripts/registerTxtRequire.js ./node_modules/ts-node/register ...
 */
const fs = require('fs');
const Module = require('module');

Module._extensions['.txt'] = function loadTxt(module, filename) {
    module.exports = fs.readFileSync(filename, 'utf8');
};
