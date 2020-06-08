const cheerio = require('cheerio');

// useful functions
function toISODate(rDate) {
    let [day, month, year, hour, minute, tz] = rDate.split(/[\.\s:]/);
    if (hour === undefined) {
        [ hour, minute, tz ] = [ '0', '0', 'мск' ];
    }
    if (tz == undefined) {
        tz = 'мск';
    }
    const offset = {
        'мск': '+03'
    }[tz];
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00${offset}`;
}

class ParseError extends Error {

}

// parser
exports.parsePurchasePage = function (html) {
    const f = {};
    const $ = cheerio.load(html);

    // definition of all variables at end of parser

    function parsePrices($titles) {
        const knownPrices = [
            'Начальная цена контракта',
            'Обеспечение контракта',
            'Обеспечение заявки'
        ]
        return $titles
            .map( (i, f) => ({
                title: $(f).text(),
                value: (() => {
                    const $price = $(f).next('.tenderField_data').find('.tenderPrice');
                    if ($price.length === 1) {
                        // TODO check currency
                        return $price.get(0).firstChild.data.trim();
                    } else if ($(f).next('.tenderField_data').text().trim() === 'сумма не задана') {
                        return false;
                    } else {
                        throw new ParseError(`Can't parse price`);
                    }
                })()
            }))
            .get()
            .reduce( (acc, item) => {
                if (item.value !== false) {
                    if (!knownPrices.includes(item.title)) throw new ParseError(`Unknown price title '${item.title}'`);
                    acc[item.title] = parseFloat(item.value.replace(/\s/, '').replace(',', '.'));
                }
                return acc;
            }, {})
    }

    // find data on page and sore to vars
    $('.tender > .blockTitle').each( (i, blockTitleNode) => {
        // main block
        if (!purchaseTitle) {
            purchaseTitle = $('h1', blockTitleNode).text();
            statusName =  $('.tenderPurchaseStatus_name', blockTitleNode).text(); // TODO convert to btrx
            {
                prices = parsePrices($('.priceWrap .tenderField_title'));
            }
            return;
        }

        const blockTitle = $(blockTitleNode).text().trim();
        const block = $(blockTitleNode).next('.blockContent');
        switch (blockTitle) {
            case 'Заказчик':
                $('.tenderField', block).each( (i, fld) => {
                    const title = $('.tenderField_title', fld).text().trim();
                    switch (title) {
                        case 'Место поставки':
                            customerDeliveryAddress = $('.tenderField_data_in', fld).text().trim();
                            break;
                        case 'Время поставки':
                            customerDeliveryTime =  $('.tenderField_data_in', fld).text().trim();
                            break;
                        default:
                            throw new ParseError(`Unknown customer block field '${title}'`);
                    }
                })
                break;
            case 'Заказчики':
                const customers = f['Заказчики'] = [];
                block.find('.multiCustomerWrap .tender_customer')
                    .each( (i, customerBlock) => {
                        const customer = {};
                        customers.push(customer);

                        const $name = $('.tender_customer_name', customerBlock);
                        $name.find('.tender_customer_num').remove();
                        customer.name = $name.text().trim();

                        const $creds = $name.next('.t-grey.t-topHalfLine');
                        customer.credentials = {};
                        $creds.text().trim().split('\n')
                            .forEach( cred => {
                                const [ name, value ] = cred.split(/\s+/);
                                customer.credentials[name] = value;
                            })

                        const $ml = $(customerBlock).next('.t-bottomML');

                        // TODO times

                        customer.prices = parsePrices($ml.find('.tender_column__s .tenderField__price .tenderField_title'));
                    })
                break;
            case 'Объекты закупки':
                goods = $('.purchaseInfo tr').not('.tender_headerRow')
                    .find('.purchaseInfo_first', block).map( (i, el) => ({
                        name: $(el).text().trim(),
                        qty: $(el).next('.purchaseInfo_last').text().trim()
                    })).get();
                break;
            case 'Условия участия':
                // TODO
                break;
            default:
                throw new ParseError(`Unknown tender block '${blockTitle}'`);
        }
    })

    // customer popup
    {
        const knownSections = [
            'Контактное лицо',
            'Заказчик',
            'Организация, размещающая заказ',
            'Специализированная организация'
        ]
        const knownFields = [
            'ФИО',
            'ИНН-КПП',
            'ОГРН',
            'ОКАТО',
            'Телефон',
            'Факс',
            'Эл. почта',
            'Почтовый адрес',
            'Местонахождение'
        ]
        $('.popup__mainContacts .tender_subtitle')
            .each( (i, el) => {
                const sectionTitle = $(el).text().trim();
                if (!knownSections.includes(sectionTitle)) {
                    throw new ParseError(`Unknown popup section '${sectionTitle}'`);
                }

                f[sectionTitle] = {};
                const _f = f[sectionTitle];

                let cur = $(el);
                while (true) {
                    cur = $(cur).next('.tenderField');
                    if (cur.length === 0) break;

                    const $title = cur.find('.tenderField_title');
                    const title = $title.text().trim();
                    if (!knownFields.includes(title)) {
                        throw new ParseError(`Unknown ${sectionTitle} field '${title}'`)
                    }
                    _f[title] = $title.next().text().trim();
                }
            })

        const contact = $('.popup__mainContacts .tender_subtitle .tender_contactPerson').text().trim();
        if (contact) {
            customerContactPerson = contact;
            [ customerFirstName, customerMiddleName, customerLastName ] = customerContactPerson.split(/\s+/);
        }
    }
    {
        // TODO порядок размещения
        const knwonTimes = [
            'Окончание подачи заявок',
            'Рассмотрение заявок',
            'Подача заявки',
            'Подведение итогов',
            'Проведение аукциона',
            'Публикация',
            'Исполнение контракта'
        ]
        f.times = {}
        function parseDate(el) {
            let time;
            const dateTimeRaw = el.text();
            if (dateTimeRaw) {
                const timeRaw = el.find('.icon__time').attr('title');
                time = toISODate(dateTimeRaw + (timeRaw ? ' ' + timeRaw : ''));
            } else {
                time = el.text();
            }
            return time;
        }
        $('.tender_rules .blockContent .tenderField')
            .each( (i, el) => {
                const $title = $('.tenderField_title', el);
                const title = $title.text().trim();
                if (!knwonTimes.includes(title)) {
                    throw new ParseError(`Unknown time field '${title}'`);
                }

                const dataIn = $title.next().find('.tenderField_data_in');
                let time;

                // period
                if (dataIn.find('.tender_period').length) {
                    time = [
                        parseDate(dataIn.find('.tender_period > .tender_date')),
                        parseDate(dataIn.find('.tender_period .tender_endDateFull .tender_date'))
                    ];
                } else {
                    time = parseDate(dataIn.find('.tender_date'));
                }

                f.times[title] = time;
            })
    }
    // TODO .tender_docs


    // define variables (to know what we can obtain from page)
    var //#vars
        purchaseTitle,
        statusName,
        prices,

        contact,
        customer,

        applicationDeadline,
        applicationReview,
        applicationFiling,
        applicationSummarize,
        applicationAuction,

        goods
        //@vars
    ;

    // collect all variables to result object
    const result = f;
    {
        const funcText = arguments.callee.toString();
        const varsText = funcText.match(/\/\/#vars(.+)\/\/@vars/s)[1];
        const varNames = varsText.trim().split(/\s*,\s*/);
        for (let varName of varNames) {
            const value = eval(varName);
            if (value !== undefined) {
                result[varName] = value;
            }
        }
    }

    return result;
}

function parsePrice(text) {
    return parseFloat(text.replace(/[^\d,.]/g, '').replace(',', '.'));
}

exports.parsePurchasePageWinners = function(html) {
    const $ = cheerio.load(html);

    const knownHeaders = {
        'Участник': (td, row) => {
            const p = td.find('p');
            if (p.length === 2) {
                // have info
                const a = p.eq(1).find('a');
                row.winner = a.text().trim();
                row.inn = a.attr('href').replace(/^\/Participants\/(\d+)\/Analysis$/, '$1');
            } else {
                // no info
                row.winner = p.text().trim();
            }
        },
        'Цена, ₽': (td, row) => {
            const p = td.find('p');
            const time = $('span.iconic.icon__time js-tooltip', p);
            if (time.length) {
                row.win_time = toISODate(time.attr('title').trim());
                time.remove();
            }
            row.win_price = parsePrice(p.text());
        },
        'Первые части заявок': (td, row) => {
            const time = td.find('span');
            if (time.length) {
                row.first_time = toISODate(time.attr('title').trim());
                time.remove();
            }
            row.first = td.text().trim();
        },
        'Вторые части заявок': (td, row) => {
            row.second = td.text().trim();
        },
        'Результаты': (td, row) => {
            row.result = td.text().trim();
        },
        'Рассмотрение заявок': (td, row) => {
            row.review = td.text().trim();
        }
    }

    const tableBlock = $('[data-id=protocols]').eq(0).next();
    const headers = tableBlock.find('tr').first().find('th').map( (i, th) => $(th).text().trim().replace(/\s+/g, ' ')).get();

    headers.forEach( header => {
        if (knownHeaders[header] === undefined) {
            throw new ParseError(`Unknown winner table column '${header}'`);
        }
    })

    return tableBlock.find('tr').map( (rowNum, tr) => {
        // skip headers row
        if (rowNum === 0) return;

        const participant = Object.create(null);
        if ($(tr).hasClass('tender_roundup__winner')) {
            participant.winner = true;
        }

        $('td', tr).each( (colNum, td) => {
            knownHeaders[headers[colNum]]($(td), participant);
        })

        return participant;
    }).get();
}