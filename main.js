// process environment files and variables
require('dotenv-flow').config();

void async function main() {
    try {
        // check config
        if (process.env.KONTUR_LOGIN === '' || process.env.KONTUR_PASSWORD === '') {
            throw new Error('Kontur credentials are required');
        }

        // init store
        const store = require('./models/Store');
        await store.connect();

        // init logger
        const log = store.createScopedLog('main');

        // create express app
        const express = require('express');
        const app = express();

        // log requests
        if (process.env.DEBUG > 0) {
            app.use( async (req, res, next) => {
                await log('Request', {
                    method: req.method,
                    path: req.path
                });
                next();
            })
        }

        // allow localhost CORS fro debug
        if (process.env.DEBUG > 0) {
            app.use( (req, res, next) => {
                if (req.headers.origin) {
                    if (req.headers.origin.match(/^https?:\/\/(localhost|127(\.\d+){3}):/)) {
                        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
                    } else {
                        res.end();
                    }
                }
                next();
            })
        }

        // add controllers/routes
        const { readdirSync } = require('fs');
        const controllersDir = __dirname + '/controllers';
        for await (let file of readdirSync(controllersDir)) {
            if (file.endsWith('.js')) {
                const route = require(controllersDir + '/' + file);
                app.use(route.path, route.module);
                await log('Route added', route.path);
            }
        }

        // GUI
        const path = require('path');
        app.use(express.static(path.join(__dirname, 'gui', 'build')));
        app.use('/', function(req, res) {
            res.sendFile(path.join(__dirname, 'gui', 'build', 'index.html'));
        });

        // start
        app.listen(process.env.WEB_PORT, async () => {
            await log('Server started', process.env.WEB_PORT);
        });

        // start scheduler
        if (process.env.SCHEDULER_AUTO_START === '1') {
            await log(`Starting schedule`);
            require('./models/Scheduler').start();
        }
    } catch(e) {
        console.error(e.message);
        if (process.env.DEBUG > 0) {
            console.error(e.stack);
        }
        process.exit(e.code || 1);
    }
}()