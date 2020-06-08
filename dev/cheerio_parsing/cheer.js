const fs = require('fs');

const sample = fs.readFileSync(__dirname + '/sample.html', 'utf8');

const parse = require('./lib/Kontur/parsers/PurchasePage');

console.log('fields ', parse(sample));