import { call } from '.';

export function getCustomerStory(inn) {
    return call({
        url: 'kontur/story/' + inn
    })
}