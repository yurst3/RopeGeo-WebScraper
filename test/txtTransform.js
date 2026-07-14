/* global module */
/** Jest transformer: load .txt files as CommonJS string exports. */
module.exports = {
    process(sourceText) {
        return {
            code: `module.exports = ${JSON.stringify(sourceText)};`,
        };
    },
};
