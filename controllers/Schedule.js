const router = require('express').Router();
const scheduler = require('../models/Scheduler');

router
    .get('/', (req, res) => {
        res.json({
			isOn: scheduler.isOn()
		})
	})
	.get('/start', (req, res) => {
		scheduler.start();
		res.json({result: true});
	})
	.get('/stop', (req, res) => {
		scheduler.stop();
		res.json({result: true});
	})

module.exports = {
    path: '/scheduler',
    module: router
}