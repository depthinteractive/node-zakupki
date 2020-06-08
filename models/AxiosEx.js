const Axios = require('axios');
const url = require('url');

module.exports = function AxiosEx(config) {
    const axios = Axios.create({
        ...config,
        maxRedirects: 0,
        validateStatus: status => true
    });

    // cookies
    axios.cookies = [];
    axios.cookies.add = (function(cookie, _url) {
        if (typeof cookie === 'string') {
            cookie = parseCookie(cookie);
        }
        let domain = url.parse(_url).host;
        if (cookie.domain === undefined) {
            cookie.domain = domain;
        }
        const index = this.findIndex( c => c.name === cookie.name && c.domain === domain );
        if (index !== -1) {
            this.splice(index, 1, cookie);
        } else {
            this.push(cookie);
        }
    }).bind(axios.cookies);
    axios.cookies.get = (function(name) {
        return this.find( cookie => cookie.name === name );
    }).bind(axios.cookies);
    axios.cookies.del = (function(name) {
        const index = this.findIndex( c => c.name === name );
        if (index !== -1) {
            this.splice(index, 1);
        }
    }).bind(axios.cookies);

    function parseCookie(cookie) {
        const result = {};
        cookie.split('; ').forEach(pair => {
            const parts = pair.split('=');
            const name = parts[0];
            const value = parts.slice(1).join('=');
            if (result.name === undefined) {
                result.name = name;
                result.value = value;
            } else {
                result[name.toLowerCase()] = (value || '').toLowerCase();
            }
        })
        return result;
    }

    axios.interceptors.request.use(config => {
        config.headers.Cookie = axios.cookies.reduce(
            (acc, cookie) => {
                // check expires
                if (cookie.expires && (new Date(cookie.expires)) <= (new Date())) {
                    axios.cookies.del(cookie.name);
                    return acc;
                }

                // check domain
                if (cookie.domain) {
                    const domain = url.parse(url.resolve(config.baseURL || '', config.url)).host;
                    if (!domain.endsWith(cookie.domain)) {
                        return acc;
                    }
                }

                // check path
                if (cookie.path) {
                    const path = url.parse(url.resolve(config.baseURL || '', config.url)).pathname;
                    if (!path.startsWith(cookie.path)) {
                        return acc;
                    }
                }

                acc.push(cookie.name + '=' + cookie.value);
                return acc;
            },
            []
        ).join('; ');

        return config;
    })

    axios.interceptors.response.use(async response => {
        if (response.headers['set-cookie'] instanceof Array) {
            response.headers['set-cookie'].forEach( rawCookie => {
                axios.cookies.add(rawCookie, url.resolve(response.config.baseURL || '', response.config.url));
            })
        }

        if ([301, 302].includes(response.status) && response.headers.location) {
            if (response.config.redirectCount > 3) {
                throw new Error("Max redirects");
            }
            return await axios.request({
                ...response.config,
                redirectCount: (response.config.redirectCount || 0) + 1,
                url: url.resolve(response.config.url, response.headers.location)
            })
        }

        return response;
    })

    return axios;
}