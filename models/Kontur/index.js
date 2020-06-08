const AxiosEx = require('../AxiosEx');
const querystring = require('querystring');
const QueryString = require('querystring');

const { parsePurchasePage, parsePurchasePageWinners } = require('./parsers/PurchasePage');
const parseXLSX = require('./parsers/TendersXLSX');

class Kontur {

    axios = AxiosEx();
    triedToLogin = false;

    constructor(log) {
        this.log = log;
    }

    async query(config) {
        if (!this.triedToLogin) {
            this.triedToLogin = true;
            await this.login();
        }

        let response = await this.axios.request(config);

        // we need to login again (session expired, multiacc)
        if (response.status === 414 || response.status === 403) {
            this.triedToLogin = false;
            response = await this.query(config);
        }

        // we should wait some time
        if (typeof response.data === 'string' && response.data.includes('<p class="t-bottomSM">Сервису нужен отдых. Повторите поиск через 1&nbsp;минуту.</p>')) {
            this.log(`Waiting while server get some rest`);
            if (config.waited && config.waited > 3) {
                throw new Error("Waited a lot");
            } else {
                await this.sleep(60000);
                return await this.query({
                    ...config,
                    waited: (config.waited || 0) + 1
                })
            }
        }
        return response;
    }

    async login(login = process.env.KONTUR_LOGIN, password = process.env.KONTUR_PASSWORD) {
        // get AntiForgery token
        await this.query({
            method: 'GET',
            url: 'https://auth.kontur.ru/login.aspx?authmode=certlogin&back=https%3A%2F%2Fzakupki.kontur.ru%2FLogin%2FCallback&customize=zakupki'
        })
        const AntiForgery = this.axios.cookies.get('AntiForgery').value;

        // perform auth
        await this.query({
            method: 'POST',
            url: 'https://auth.kontur.ru/Handlers/GetTokenByPassword.ashx?version=v5',
            headers: {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            data: querystring.stringify({
                login,
                password,
                remember: false,
                AntiForgery
            })
        })

        // first query to finalize auth (some redirects appear)
        await this.query({
            method: 'GET',
            url: 'https://zakupki.kontur.ru/grid'
        })

        this.log(`Logined ok`);
    }

    /**
     * parse and basicaly verify grid form
     * @param {*} param0 callbacks
     */
    async parseGridForm({
        templatesCallback,
        welcomeCallback,
        markersCallback,
        favoritesCallback
    }) {
        const formData = {};
        const response = await this.query({
            method: 'GET',
            url: 'https://zakupki.kontur.ru/Grid',
            headers: {
                accept: 'text/html',
            },
            responseType: 'text'
        })
        const html = response.data;

        // _INITIAL_STATE_
        let _INITIAL_STATE_ = html.match(/^\s*window\._INITIAL_STATE_\s*=\s*(?<json>.+);\s*$/m);
        formData.initialState = JSON.parse(_INITIAL_STATE_.groups.json);

        // extract templates
        templatesCallback && templatesCallback(formData.initialState.templates);
        delete formData.initialState.templates;

        // extract welcome
        welcomeCallback && welcomeCallback(formData.initialState.welcome);
        delete formData.initialState.welcome;

        // extract markers
        markersCallback && markersCallback(formData.initialState.markers);
        delete formData.initialState.markers;

        // extract favorites
        favoritesCallback && favoritesCallback(formData.initialState.favorites);
        delete formData.initialState.favorites;




        // TODO parse form values from html


        return formData;
    }

    templateToQuery(tpl, {
        PurchaseStatuses = [ "1", "4" ],
        page = 0,
        sort = 0
    }) {
        return {
            'Query.CategoryIds': tpl.categories.map( c => c.id ),
            'Query.Inns': [], // TODO
            'Query.PurchaseStatuses': PurchaseStatuses,
            'Query.RegionIds': tpl.regions, // TODO
            'Query.Text': tpl.text,
            'Regions': tpl.regions,  // TODO
            'Query.Laws': tpl.laws.map( l => l.id ),
            'Query.Procedures': tpl.procedures.map( p => p.id ),
            'Query.ElectronicPlaces': tpl.electronicPlaces.map( p => p.id ),
            'Query.Exclude': "", // TODO
            'Query.Smp': tpl.smp,
            'Query.PageNumber': page,
            'Query.SortOrder': sort
        }
    }

    sleep = async (ms) => new Promise( resolve => setTimeout(() => resolve(), ms))

    async *purchasesXLSX(query) {
        const requestData = { ...query, asExcel: true };
        delete requestData['Query.PageNumber'];
        delete requestData['Query.SortOrder'];
        const response = await this.query({
            method: 'GET',
            url: 'https://zakupki.kontur.ru/grid',
            params: requestData,
            paramsSerializer: QueryString.stringify,
            responseType: 'arraybuffer'
        });

        for (let purchase of parseXLSX(response.data)) {
            yield purchase;
        }
    }

    async *purchasesAPI(query) {
        let found = 0;
        let total = 0;
        let page = 0;
        const requestData = { ...query, 'Query.PageNumber': page };
        do {
            const response = await this.query({
                method: 'POST',
                url: 'https://zakupki.kontur.ru/grid/api',
                data: requestData
            });

            for (let purchase of response.data.purchases) {
                yield purchase;
            }

            total = response.data.total;
            found += response.data.purchases.length;

            requestData['Query.PageNumber']++;
        } while (found < total);
    }


    async getPurchaseHTML(url) {
        return (await this.query({
            method: 'GET',
            url
        })).data;
    }

    parsePurchasePage = parsePurchasePage;

    parsePurchasePageWinners = parsePurchasePageWinners;

    async getRegions(prefix) {
        const response = await this.query({
            method: 'GET',
            url: 'https://zakupki.kontur.ru/Region/Suggest',
            params: {
                prefix
            }
        })

        return response.data;
    }

}

module.exports = new Kontur(
    require('../Store').createScopedLog('kontur')
)