const { konturParse, feedBitrix } = require('./Algos');
const log = require('./Store').createScopedLog('scheduler');

module.exports = {
	interval: 5 * 60 * 1000, // 5 min
	shouldContinue: false,
	timeoutID: 0,

	bitrixInProgress: false,

	shouldWeParse() {
		const now = new Date();
		const targetOffset = -180; // MSK

		// set offset to MSK
		const tzDiff = targetOffset - now.getTimezoneOffset();
		now.setTime(now.getTime() - tzDiff * 60 * 1000);

		// from monday to friday is ok
		const day = now.getDay();
		if (day < 1 || day > 5) {
			return false;
		}

		// from 7 till 21 hours is ok
		const start = 7 * 60;
		const end = 21 * 60;
		const cur = now.getHours() * 60 + now.getMinutes();
		if (cur < start || cur > end) {
			return false;
		}

		return true;
	},

	async doAction() {
		try {
			if (this.shouldWeParse()) {
				log('Start');
				const newPruchases = [];
				await konturParse(log, newPruchases);
				await log(`Found new purchases`, newPruchases);

				if (this.bitrixInProgress === false) {
					this.bitrixInProgress = true;
					const newLeads = [];
					feedBitrix(log, newLeads)
						.finally(async () => {
							this.bitrixInProgress = false;
							await log(`Exported new leads to Bitrix`, newLeads);
						})
				}
			}
		} catch(e) {
			log(`Error`, {
				message: e.message,
				stack: e.stack
			});
		} finally {
			// set another timeout
			if (this.shouldContinue) {
				this.timeoutID = setTimeout( () => {
					this.doAction();
				}, this.interval);
			}
		}
	},

	isOn() {
		return this.timeoutID !== 0;
	},

	start() {
		if (!this.isOn()) {
			this.doAction();
			this.shouldContinue = true;
		}
	},

	stop() {
		if (this.isOn()) {
			clearTimeout(this.timeoutID);
			this.shouldContinue = false;
			this.timeoutID = 0;
		}
	}
}