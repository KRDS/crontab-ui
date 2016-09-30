'use strict';

const cronParser = require('cron-parser');
const error = require('http-errors');
const exec = require('child_process').exec;
const fs = require('fs');
const md5sum = require('./md5sum');
const os = require('os');
const uniqid = require('uniqid');

class Cronjob {
	constructor(command, schedule) {
		this.id = uniqid();
		this.schedule = schedule;
		this.command = command;
		this.next = parseNext(schedule);
	}
}

function parseNext(schedule) {
	if (schedule === '@reboot') {
		return 'reboot';
	} else {
		return cronParser.parseExpression(schedule).next().toISOString();
	}
}

exports.listCrons = function(cb) {
	loadCrontab((err, crontab, checksum) => {
		if (err) cb(err);
		cb(null, crontab, checksum);
	});
};

exports.saveCrontab = function(newCrontab, oldChecksum, callback){
	loadCrontab((err, crontab, currentChecksum) => {
		if (err) {
			return callback(err);
		}
		else if (currentChecksum !== oldChecksum) {
			return callback(error(409, 'crontab has changed'));
		}
		else updateCrontab(newCrontab, (err) => {
			if (err) callback(err);
			else loadCrontab(callback);
		});
	});
};

function updateCrontab(newCrontab, callback) {
	let crontabString = '';
	let tmpPath = `${os.tmpdir()}/cronui-${uniqid()}`;

	console.log('writing temp crontab to %s', tmpPath);

	newCrontab.forEach(function(cron){
		crontabString += cron.schedule + ' ' + cron.command + '\n';
	});

	fs.writeFile(tmpPath, crontabString, function(err) {
		if (err) return callback(err);
		else exec(`crontab ${tmpPath}`, callback);
	});
}

/**
 * Loads the current system crontab. Yields the parsed crontab and a checksum
 * over it's content. Use the checksum if you want to update the crontab to 
 * ensure it hasn't changed inbetween.
 */
function loadCrontab(cb) {
	const regex = /^((\@[a-zA-Z]+\s)|(([^\s]+)\s([^\s]+)\s([^\s]+)\s([^\s]+)\s([^\s]+)\s))/;

	exec('crontab -l', function(err, stdout, stderr) {
		if (err) return cb(err);

		const checksum = md5sum(stdout);
		const lines = stdout.split("\n");
		const crontab = [];

		for (let line of lines) {
			if (line.match('^#')) continue;

			let command = line.replace(regex, '').trim();
			let schedule = line.replace(command, '').trim();

			if (!command || !schedule) continue;
			else crontab.push(new Cronjob(command, schedule));
		}

		cb(null, crontab, checksum);
	});
};
