import Axios from 'axios';

const axios = Axios.create();

export async function call(config) {
    let url = config.url;
    if (!/^https?:/.test(url)) {
        url = process.env.REACT_APP_API_PREFIX + url;
    }

    const response = await axios.request({
        ...config,
        url
    });

    if (response.status === 200) {
        return response.data;
    } else {
        throw response;
    }
}