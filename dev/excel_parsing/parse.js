const parser = require('../../models/Kontur/parsers/TendersXLSX');
const fs = require('fs');

const fileData = fs.readFileSync( __dirname + '/sample.xlsx');

for (let tender of parser(fileData)) {
	console.log(JSON.stringify(tender, null, '\t'));
	break;
}
