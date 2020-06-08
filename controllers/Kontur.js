const router = require('express').Router();
const store = require('../models/Store');
const kontur = require('../models/Kontur');
const { konturParse } = require('../models/Algos');

router
    .get('/new', async (req, res) => {
        const log = store.createScopedLog('newPurchases');
        const result = {
            newPurchases: []
        };
        await konturParse(log, result.newPurchases);
        res.json(result);
    })
    .get('/story/:inn', async (req, res) => {
        const log = store.createScopedLog('customerStory');
        const result = {
            purchases: []
        }

        const queryInfo = await store.getStoryQuery();
        const query = JSON.parse(queryInfo.json);
        query['Query.Inns'].push(req.params.inn);
        query['Query.PurchaseStatuses'] = [ '3' ]; // finished

        // date from
        // TODO extract to Utils or use moment.js?
        const from = new Date();
        from.setFullYear(from.getFullYear() - 3);
        query['Query.PublishDateFrom'] = from.getDate().toString().padStart(2, '0') + '.' +
            (from.getMonth() + 1).toString().padStart(2, '0') + '.' +
            from.getFullYear();

        await log('Story query', {
            queryName: queryInfo.name,
            inns: query['Query.Inns'],
            statuses: query['Query.PurchaseStatuses']
        });

        for await (meta of kontur.purchasesXLSX(query)) {
            // check for oldness
            if (new Date(meta["Закупка"]["Дата публикации"]) < from) {
                continue;
            }

            // add purchase if not known yet
            await store.addPurchaseMeta(meta, false);

            // get html of page
            const html = await kontur.getPurchaseHTML(meta['Закупка']['Номер_Ссылка']);

            // update html in db
            await store.addPurchaseData(meta['Закупка']['Номер'], {html});

            let winners;
            try {
                winners = kontur.parsePurchasePageWinners(html);
            } catch(e) {
                await log('Can\'t parse winners', {
                    notificationId: meta['Закупка']['Номер'],
                    error: e.message
                })
            }

            // store winners
            await store.addPurchaseData(meta['Закупка']['Номер'], {winners});

            result.purchases.push({
                meta,
                winners
            });
        }

        res.json(result);
    })

module.exports = {
    path: '/kontur',
    module: router
}