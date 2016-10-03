'use strict';

const bodyParser = require('body-parser');
const config = require('./configure');
const crontab = require('./lib/crontab');
const error = require('http-errors');
const express = require('express');
const path = require('path');

const app = express();

app.use(bodyParser.json());

// static stuff
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/public/css'));
app.use(express.static(__dirname + '/public/js'));

// views
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// set port
app.set('port', config.port);

app.get('/', function(req, res, next) {
	crontab.listCrons((err, crontab, checksum) => {
		if (err) next(err);
		else res.render('index', {
			checksum: checksum, 
			crontab: crontab, 
			json: renderJSON,
			hostname: config.hostname,
			email: config.errorEmail,
		});
	});
});

// render JSON in a way it's safe for the view engine to parse.
function renderJSON(data) {
	return JSON.stringify(data)
		.replace(/\\/g, '\\\\') // escape backslashes
		.replace(/\'/g, '\\\''); // escape single quotes
}

app.post('/save_crontab', function(req, res, next) {
	if (!req.body.checksum) return next(error(400, 'checksum is missing'));
	if (!req.body.crontab) return next(error(400, 'crontab is missing'));

	const checksum = req.body.checksum;
	const newCrontab = req.body.crontab;

	crontab.saveCrontab(newCrontab, checksum, (err, newCrontab, newChecksum) => {
		if (err) next(err);
		else res.status(200).json({checksum: newChecksum, crontab: newCrontab});
	});
});

// error handler
app.use(function(err, req, res, next) {
	var data = {};
	var statusCode = err.statusCode || 500;

	data.message = err.message || 'internal server error';

	if (process.env.NODE_ENV === 'development' && err.stack) {
		data.stack = err.stack
	}
	if (parseInt(statusCode) >= 500) {
		console.error(err);
	}

	res.status(statusCode).json(data);
});

app.listen(app.get('port'), function() {
	console.log("Crontab UI is running at http://localhost:" + app.get('port'));
});
