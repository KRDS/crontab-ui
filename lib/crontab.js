'use strict';

const cronParser = require('cron-parser');
const error = require('http-errors');
const exec = require('child_process').exec;
const fs = require('fs');
const md5sum = require('./md5sum');
const os = require('os');
const uniqid = require('uniqid');
const path = require('path');

/**
 * A line in the system crontab that represents an actual job with a schedule and a command.
 */
class Cronjob {
	constructor(command, schedule) {
		this.id = uniqid();
		this.schedule = schedule;
		this.command = command;
		this.next = parseNext(schedule);
		this.type = 'cronjob';
		this.stopped = false;
	}

	toString() {
		return this.schedule + ' ' + this.command
	}
}

/**
 * Line in the system crontab that does NOT represent an actual job, it will be memorized and 
 * written back to the crontab as is.
 */
class Cronline {
	constructor(content) {
		this.id = uniqid();
		this.content = content;
		this.type = 'cronline';
	}

	toString() {
		return this.content;
	}
}

/**
 * Contains all lines in the system crontab. Each entry has a toString() method that can be used
 * to serialize it back into the system crontab.
 */
class Crontab {
	constructor(checksum, lines) {
		this._checksum = checksum;
		this._lines = {};
		for (let line of lines) {
			this._lines[line.id] = line;
		}
	}

	// returns all lines that are actual cronjobs
	get jobs() {
		return this.lines.filter(line => line instanceof Cronjob);
	}

	// returns all lines, cronjob or not
	get lines() {
		return Object.keys(this._lines).map(key => this._lines[key]);
	}

	// checksum of the underlying crontab
	get checksum() {
		return this._checksum;
	}

	// returns a JSON-able representation of the crontab. Does not return actual JSON, but an 
	// object that should serialized into JSON instead.
	toJSON() {
		return {
			lines: this.lines,
			checksum: this.checksum
		}
	}
}

/**
 * Builds a new Crontab instance from its serialized representation as sent by the client. Inverse
 * operation to Crontab#toJSON()
 */
exports.fromJSON = function(body) {
	const checksum = body.checksum;
	const lines = [];

	for (let line of body.lines) {
		if (line.type === 'cronline') {
			lines.push(new Cronline(line.content));
		}
		else if (line.type === 'cronjob') {
			lines.push(new Cronjob(line.command, line.schedule));
		}
		else {
			throw error(400, 'unrecognized line type: '+line.type);
		}
	}

	return new Crontab(checksum, lines);
}

/**
 * Return the next execution time for given cron schedule as ISO date string. If schedule is at 
 * '@reboot' the resulting string will be 'reboot'.
 */
function parseNext(schedule) {
	if (schedule === '@reboot') {
		return 'reboot';
	} else {
		return cronParser.parseExpression(schedule).next().toISOString();
	}
}

// exports.Cronjob = Cronjob;
// exports.Cronline = Cronline;

/**
 * List all cronjobs in the current system crontab. Will return a `Crontab` instance containing
 * __all__ the lines in the crontab.
 */
exports.listCrons = function(cb) {
	loadCrontab((err, crontab, checksum) => {
		if (err) cb(err);
		else cb(null, crontab, checksum);
	});
};

/**
 * Save current crontab to disk. Crontab object must have a property `checksum` which is the md5
 * checksum of the crontab file at the time it was parsed. If the given checksum does not match
 * the current checksum of the crontab on disk, the callback will be invoked with an error object 
 * with code 409 (conflict)
 */
exports.saveCrontab = function(newCrontab, cb){
	loadCrontab((err, currentCrontab) => {
		if (err) {
			return cb(err);
		}
		else if (newCrontab.checksum !== currentCrontab.checksum) {
			return cb(error(409, 'crontab has changed'));
		}
		else updateCrontab(newCrontab, (err) => {
			if (err) cb(err);
			else loadCrontab(cb);
		});
	});
};

function updateCrontab(newCrontab, callback) {
	let crontabString = '';
	let tmpPath = `${os.tmpdir()}/cronui-${uniqid()}`;

	newCrontab.lines.forEach(function(line) {
		crontabString += line.toString() + '\n';
	});

	fs.writeFile(tmpPath, crontabString, function(err) {
		if (err) return callback(err);
		else exec(`crontab ${tmpPath}`, callback);
	});
}

/**
 * Loads the current system crontab. Yields the parsed crontab containing a checksum over its 
 * content. Checksum can be used to ensure the system crontab has not changed since it was parsed.
 */
function loadCrontab(cb) {
	const regex = /^((\@[a-zA-Z]+\s)|(([^\s]+)\s([^\s]+)\s([^\s]+)\s([^\s]+)\s([^\s]+)\s))/;

	exec('crontab -l', function(err, stdout, stderr) {
		if (err && !stderr.match(/no crontab/i)) {
			return cb(err);
		}

		const checksum = md5sum(stdout);
		const lines = [];

		for (let line of stdout.split('\n')) {
			// comment
			// if (line.match('^#')) {
			// 	lines.push(new Cronline(line));
			// }

			let command = line.replace(regex, '').trim();
			let schedule = line.replace(command, '').trim();

			// misc line or actual cronjob?
			if (!command || !schedule) {
				lines.push(new Cronline(line));
			}
			else {
				lines.push(new Cronjob(command, schedule));
			}
		}

		const crontab = new Crontab(checksum, lines);
		cb(null, crontab);
	});
};
