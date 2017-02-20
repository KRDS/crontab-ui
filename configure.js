'use strict';

const os = require('os');
const pkg = require('./package.json');

const config = module.exports = {
    port: process.env.PORT || 8000,
    hostname: os.hostname(),
    username: process.env.USER || null,
    version: pkg.version
}
