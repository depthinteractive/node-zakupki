const XLSX = require('xlsx');

function setObject(obj, path, value) {
    const segments = path.split('.');
    const last = segments.pop();
    let cur = obj;
    for (let seg of segments) {
        if (cur[seg] === undefined) {
            cur[seg] = Object.create(null);
        }

        cur = cur[seg];
    }
    cur[last] = value;
}

module.exports = function*(fileData) {
	const workbook = XLSX.read(fileData, {
		cellDates: false
	});
	const dateMode = workbook.Workbook.WBProps.date1904;
	const sheet = workbook.Sheets['Лист1'];

	const headerKeys = [];
	for (let col = 0; true; col++) {
		const colName = XLSX.utils.encode_col(col);
		const firstHeader = sheet[colName + '1'];
		if (firstHeader === undefined) break;

		headerKeys.push(firstHeader.v.trim() + '.' + sheet[colName + '2'].v.trim());
	}

	// TODO check if all headers are known and expected

	for (let row = 3; true; row++) {
		const firstCell = sheet['A' + row];
		if (firstCell === undefined) break;

		const tender = Object.create(null);
		setObject(tender, headerKeys[0], firstCell.v);
		if (firstCell.l) {
			setObject(tender, headerKeys[0] + '_Ссылка', firstCell.l.Target.split('?')[0]); // no UTM
		}

		for (let col = 1; col < headerKeys.length; col++) {
			const colName = XLSX.utils.encode_col(col);
			const cell = sheet[colName + row];
			const propName = headerKeys[col];

			// special parsing for dates (workaround for XLSX's bug 1223)
			if ([
				'Закупка.Дата публикации',
				'Закупка.Окончание приема заявок',
				'Закупка.Проведение отбора',
				'Закупка.Планируемая дата публикации'
			].includes(propName)) {
				setObject(tender, propName, XLSX.SSF.format('yyyy-mm-dd"T"hh:mm:ss"+03:00"', cell.v, { date1904: dateMode }));
			} else {
				setObject(tender, propName, cell.v);
			}

			// get link from cell
			if (cell.l) {
				setObject(tender, propName + '_Ссылка', cell.l.Target);
			}
		}

		yield tender;
	}
}