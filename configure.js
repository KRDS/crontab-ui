'use strict';

const os = require('os');

const config = module.exports = {
    port: process.env.PORT || 8000,
    hostname: os.hostname(),
    username: process.env.USER || null
}
