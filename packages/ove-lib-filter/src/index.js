const getPredicate = require('./filter').getPredicate;
const parse = require('./parser').parse;

module.exports = { getPredicate: getPredicate, parse: parse };

window.Filter = module.exports;
