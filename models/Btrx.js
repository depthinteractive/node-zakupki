const Axios = require('axios');

class Btrx {
    urlPrefix = process.env.BITRIX_HOOK_PREFIX;
    axios = Axios.create();


    async call(method, params) {
        const response = await this.axios({
            method: 'POST',
            url: this.urlPrefix + '/' + method,
            data: params
        })

        return response.data.result;
    }

    async addLead(leadFields) {
        return await this.call('crm.lead.add', {
            fields: {
                ...leadFields,

                STATUS_ID: process.env.BITRIX_NEW_LEAD_STATUS_ID,
                SOURCE_ID: process.env.BITRIX_SOURCE_ID,
                ASSIGNED_BY_ID: process.env.BITRIX_ASSIGNED_BY_ID,

                // ссылка на аналитику
                UF_CRM_1570687978: process.env.BITRIX_CALLBACK_PREFIX + '/customer/story/' + leadFields.UF_CRM_1542779780
            }
        })
    }

    async getLeadUserFields() {
        return await this.call('crm.lead.userfield.list', {
            SORT: {
                ORDER: 'ASC'
            }
        })
    }

    async updateLeadUserField(id, fields) {
        await this.axios({
            method: 'POST',
            url: this.urlPrefix + '/crm.lead.userfield.update',
            params: {id},
            data: { fields }
        })
    }
}

module.exports = new Btrx();