const MongoClient = require('mongodb').MongoClient;

class Store {
    mongoURI = this.buildMongoUri();
    mongoClient = null;
    mongo = null;
    purchasesCol = null;

    buildMongoUri({
        host = process.env.MONGO_HOST,
        port = process.env.MONGO_PORT,
        user = process.env.MONGO_USER,
        password = process.env.MONGO_PASSWORD
    } = {}) {
        let uri = 'mongodb://';
        if (user) {
            uri += user;
            if (password) {
                uri += ':' + password;
            }
            uri += '@'
        }
        uri += host;
        if (port) {
            uri += ':' + port;
        }
        return uri;
    }

    async connect() {
        // mongo
        this.mongoClient = new MongoClient(this.mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        await this.mongoClient.connect();
        this.mongo = this.mongoClient.db(process.env.MONGO_DB);
        await this.checkOrTuneMongo();
    }

    async checkOrTuneMongo() {
        this.purchasesCol = this.mongo.collection(process.env.MONGO_PURCHASES_COLLECTION);

        const numberIndexName = 'itemNumber';
        try {
            await this.purchasesCol.indexExists(numberIndexName);
        } catch(e) {
            if (e.code !== 26) throw e;
            await this.purchasesCol.createIndex(
                'notificationId',
                {
                    name: numberIndexName,
                    unique: true
                }
            )
        }

        // TODO refactor for mysql
        this.queriesCol = this.mongo.collection('queries');
        if ((await this.queriesCol.stats()).count === 0) {
            await this.queriesCol.insertOne({
                name: 'Денис Антивирус',
                enabled: true,
                json: JSON.stringify(require(__dirname + '/../config/query.json'))
            })
        }

        this.logCol = this.mongo.collection('log');
        const logIndexName = 'instanceTimeFlow';
        try {
            await this.logCol.indexExists(logIndexName);
        } catch(e) {
            if (e.code !== 26) throw e;
            await this.logCol.createIndex(
                {
                    instance: 1,
                    time: 1
                },
                {
                    name: logIndexName
                }
            )
        }

        // init log - obtain this instance id
        const lastInstanceRecord = await this.logCol.find().sort({instance: -1}).limit(1).next();
        this.instanceId = (
            lastInstanceRecord ? lastInstanceRecord.instance : 0
        ) + 1;
        await this.log('Instance initialized');
    }

    async *getEnabledQueries() {
        const cursor = await this.queriesCol.find({enabled:true});
        while (await cursor.hasNext()) {
            yield cursor.next();
        }
    }

    async getStoryQuery() {
        const cursor = await this.queriesCol.find({name:'Денис Антивирус'});
        return cursor.next();
    }

    async addPurchaseMeta(meta, forExport = true) {
        const itemToInsert = {
            createdAt: (new Date()),
            passedToCRM: forExport ? null : false,
            notificationId: meta['Закупка']['Номер'],
            meta
        }

        try {
            const result = await this.purchasesCol.insertOne(itemToInsert);
            return result.insertedId;
        } catch(e) {
            if (e.code !== 11000) { // duplicate index is ok
                throw e;
            }
            return false;
        }
    }

    async getPurchase(notificationId) {
        return await this.purchasesCol.find({notificationId}).next();
    }

    async isPurchaseHaveFields(notificationId) {
        const purchase = await this.getPurchase(notificationId);
        return purchase.fields !== null;
    }

    async addPurchaseData(notificationId, data) {
        await this.purchasesCol.updateOne(
            {
                notificationId
            },
            {
                $set: data
            }
        )
    }

    async *getUnparsedPurchases() {
        const cursor = this.purchasesCol.find({
            notificationId: '0848300049019000661'
            // parsedFields: { $exists: false },
            // html: { $exists: true }
        }).sort({ "notificationId": 1 })
        while (await cursor.hasNext()) {
            yield cursor.next();
        }
    }

    async *getPurchasesToExport() {
        const cursor = await this.purchasesCol.find({
            passedToCRM: null
        });
        while (await cursor.hasNext()) {
            yield cursor.next();
        }
    }

    async markPurchaseExported(notificationId, leadNum) {
        return this.purchasesCol.updateOne(
            {
                notificationId
            },
            {
                $set: {
                    passedToCRM: (new Date()),
                    leadInCRM: leadNum
                }
            }
        )
    }

    async getAllKnownETPNames() {
        const etpNames = await this.purchasesCol.distinct('meta.Закупка.ЭТП');

        // remove empty name from list
        const emptyIndex = etpNames.indexOf('');
        if (emptyIndex !== -1) {
            etpNames.splice(emptyIndex, 1);
        }

        // add name for no ETP
        etpNames.push(process.env.BITRIX_NO_ETP_NAME);

        return etpNames;
    }

    async log(message, data, scope) {
        const record = {
            instance: this.instanceId,
            time: (new Date()),
            message
        }
        if (data) {
            record.data = data;
        }
        if (scope) {
            record.scope = scope;
        }
        await this.logCol.insertOne(record);

        if (process.env.DEBUG > 0) {
            console.log(`${record.time.toISOString()}${scope ? ` [${scope}]` : ''} ${message}`, data || '');
        }
    }

    createScopedLog(scope) {
        return (message, data) => this.log(message, data, scope);
    }
}

module.exports = new Store()