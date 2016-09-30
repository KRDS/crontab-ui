'use strict';

const crypto = require('crypto');

module.exports = function md5sum(data, encoding) {
    return crypto.createHash('md5')
        .update(data, encoding || 'utf8')
        .digest('hex');
}
