

function k2bCurrency(kCur) {
    // TODO get currencies from btrx and compare
    return kCur;
}

exports.purchaseMetaToNewLead = function(meta, ETPsMap) {
    const r = Object.create(null);

    r.TITLE = meta['Закупка']['Название'];

    // ETP
    r.UF_CRM_1569407249 = ETPsMap[meta['Закупка']['ЭТП'] || process.env.BITRIX_NO_ETP_NAME];
    r.UF_CRM_1569414087 = meta['Закупка']['ЭТП_Ссылка'];

    {
        const contact = meta['Закупка']['Контактное лицо'];
        if (contact !== '') {
            let [ fio, PHONE, EMAIL ] = contact.split('. ');
            const [ LAST_NAME, NAME, SECOND_NAME ] = fio.split(/\s+/);

            const morePhones = meta['Заказчик']['Телефон'].split(/\s+/s);

            if (PHONE) {
                PHONE = [ PHONE, ...morePhones ];
            } else {
                PHONE = morePhones;
            }

            Object.assign(r, {
                NAME,
                SECOND_NAME,
                LAST_NAME,
                HAS_PHONE: PHONE ? 'Y' : 'N',
                PHONE: PHONE.map(p => ({VALUE: p, VALUE_TYPE: 'WORK'})),
                HAS_EMAIL: EMAIL ? 'Y' : 'N',
                EMAIL
            })
        }
    }

    r.COMPANY_TITLE = meta['Заказчик']['Название'];

    r.STATUS_DESCRIPTION = meta['Закупка']['Этап отбора'];

    r.ADDRESS = meta['Заказчик']['Место поставки'];

    r.CURRENCY_ID = k2bCurrency(meta['Закупка']['Валюта закупки']);

    r.ORIGIN_ID =
    r.UF_CRM_1542779742 = meta['Закупка']['Номер'];

    r.UF_CRM_1542779780 = meta['Заказчик']['ИНН'];

    r.UF_CRM_1569491333 = meta['Закупка']['НМЦ'];

    // Крайний срок подачи заявки
    r.UF_CRM_1548759096 = meta['Закупка']['Окончание приема заявок'];

    r.UF_CRM_1569491532 = meta['Закупка']['Обеспечение заявки'];

    r.UF_CRM_1548759354 = meta['Закупка']['Проведение отбора'];


    r.UF_CRM_1550663987 = meta['Закупка']['Дата публикации'];

    r.UF_CRM_1569491483 = meta['Закупка']['Обеспечение контракта'];

    r.UF_CRM_1569491623 = meta['Закупка']['Тип торгов'];

    r.UF_CRM_1569491676 = meta['Закупка']['Способ отбора'];

    r.UF_CRM_1569491761 = meta['Закупка']['СМП'] === '' ? 'N' : 'Y';

    r.UF_CRM_1569491879 = meta['Закупка']['Размещает  закупку'];

    r.UF_CRM_1569492497 = meta['Закупка']['Планируемая дата публикации'];

    r.UF_CRM_1569492648 = meta['Заказчик']['Регион'];

    r.UF_CRM_1569492696 = meta['Заказчик']['КПП'];

    r.UF_CRM_1569494489 = meta['Закупка']['Номер_Ссылка'];

    // remove undefined and empty fields
    for (let field in r) {
        if (r[field] === undefined || r[field] === '') {
            delete r[field];
        }
    }

    return r;
}

exports.purchaseToLead = function (purchase) {

    const f = purchase.fields;

    return {
        fields: {
            UF_CRM_1542779742: purchase.notificationId,
            UF_CRM_1549393147: 'https://zakupki.kontur.ru' + meta.purchaseUrl,

            TITLE: f.purchaseTitle,

            NAME: f.customerFirstName,
            SECOND_NAME: f.customerMiddleName,
            LAST_NAME: f.customerLastName,
            COMPANY_TITLE: f.customerTitle,
            ADDRESS: f.customerPostAddress || f.customerPositionAddress || f.customerDeliveryAddress,

            HAS_PHONE: (f.contactPhone ? 'Y' : 'N'), PHONE: f.contactPhone,
            HAS_EMAIL: (f.contackEmail ? 'Y' : 'N'), EMAIL: f.contackEmail,

            // TODO ORIGIN_ID, ORIGINATOR_ID

            UF_CRM_1542779780: f.customerInn,
            UF_CRM_1542780264: f.prices['Начальная цена контракта'],
            UF_CRM_1552976279: f.prices['Обеспечение контракта'],

            UF_CRM_1548759096: f.applicationDeadline,
            UF_CRM_1548759354: f.applicationDeadline,
            UF_CRM_1542780108: f.applicationFiling
        }
    }
}

function dropBBtags(str) {
    return str.replace(/\[[^\]]+\]/g, '');
}

function toISODate(rDate) {
    let [day, month, year, hour, minute, tz] = rDate.split(/[\.\s:]/);
    if (hour === undefined) {
        [ hour, minute, tz ] = [ '0', '0', 'мск' ];
    }
    const offset = {
        'мск': '+03'
    }[tz];
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00${offset}`;
}

function toFloat(rFloat) {
    return parseFloat(rFloat.replace(/\s/g, '').replace(',', '.'));
}