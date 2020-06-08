const store = require('./Store');
const kontur = require('./Kontur');
const bitrix = require('../models/Btrx');
const { purchaseMetaToNewLead } = require('../models/Converter');

exports.konturParse = async (log, newPurchases) => {
	for await (let queryInfo of store.getEnabledQueries()) {
		await log(`Using query`, queryInfo.name);
		const query = JSON.parse(queryInfo.json);

		for await (let purchase of kontur.purchasesXLSX(query)) {
			const id = await store.addPurchaseMeta(purchase);
			if (id === false) {
				// mark for export if not yet
				purchase = await store.getPurchase(purchase['Закупка']['Номер']);
				if (purchase.passedToCRM === false) {
					await store.addPurchaseData(purchase['Закупка']['Номер'], {passedToCRM: null});
				}
				continue;
			}

			await log('Found new purchase', purchase['Закупка']['Номер']);
			newPurchases.push(purchase['Закупка']['Номер']);
		}
	}
}

exports.feedBitrix = async (log, newLeads) => {
	// update ETP list field on bitrix
	let ourFields = (await bitrix.getLeadUserFields())
		.filter( f => f.XML_ID !== null && f.XML_ID.startsWith('KP_'))
		.reduce( (acc, field) => (acc[field.XML_ID] = field, acc), {});

	const ETPsToAdd = await store.getAllKnownETPNames();

	// TODO somewhere create KP_ETP field if not exists in btrx
	ourFields.KP_ETP.LIST.forEach( item => {
		const indexInKnow = ETPsToAdd.findIndex( etpName => etpName === item.VALUE);
		if (indexInKnow !== -1) {
			ETPsToAdd.splice(indexInKnow, 1);
		}
	})

	if (ETPsToAdd.length) {
		const updateFieldQuery = {
			LIST: [
				...ourFields.KP_ETP.LIST,
				...(ETPsToAdd.map(VALUE => ({
					VALUE,
					DEF: (VALUE === process.env.BITRIX_NO_ETP_NAME) ? 'Y' : 'N'
				})))
			]
		}

		await bitrix.updateLeadUserField(ourFields.KP_ETP.ID, updateFieldQuery);

		await log(`New ETP names added to Bitrix`, ETPsToAdd.length);

		ourFields = (await bitrix.getLeadUserFields())
			.filter( f => f.XML_ID !== null && f.XML_ID.startsWith('KP_'))
			.reduce( (acc, field) => (acc[field.XML_ID] = field, acc), {});
	}

	const ETPsMap = ourFields.KP_ETP.LIST.reduce( (acc, item) => {
		acc[item.VALUE] = item.ID;
		return acc;
	}, Object.create(null));

	// export purchases
	for await (let purchase of store.getPurchasesToExport()) {
		const leadFields = purchaseMetaToNewLead(purchase.meta, ETPsMap);

		const leadNum = await bitrix.addLead(leadFields);
		await log('Lead exported', {
			notificationId: purchase.notificationId,
			leadNum
		});

		await store.markPurchaseExported(purchase.notificationId, leadNum);
		newLeads.push(leadNum);
		await store.addPurchaseData(purchase.notificationId, { leadFields });
	}
}