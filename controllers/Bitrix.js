const router = require('express').Router();
const store = require('../models/Store');
const { feedBitrix } = require('../models/Algos');

router
    .put('/leads/new', async (req, res) => {
        const log = store.createScopedLog('newLeads');
        const result = {
            newLeads: []
        }

        await feedBitrix(log, result.newLeads);

        res.json(result);
    })
    // .patch('/clean', async (req, res) => {
    //     const log = store.createScopedLog('cleanup');
    //     const all = await bitrix.call('crm.lead.list', {
    //         "filter": {
    //             "STATUS_ID": 7
    //         },
    //         "select": [ "ID" ]
    //     })

    //     for (let lead of all) {
    //         await bitrix.call('crm.lead.delete', {id: lead.ID});
    //         await log(`Deleted lead`, lead.ID);
    //     }

    //     res.json(all);
    // })

module.exports = {
    path: '/bitrix',
    module: router
}