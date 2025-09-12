"use strict";

/**
 * 401 (Unauthorized) Response
 *
 * Similar to 403 Forbidden.
 * Specifically for use when authentication is possible but has failed or not yet been provided.
 * Error code response for missing or invalid authentication token.
 */

const _ = require('lodash');

exports.unauthorized = function unauthorized(data, config) {

    const code = _.get(config, 'code', 'E_UNAUTHORIZED');
    const message = _.get(config, 'message', `Missing or invalid authentication token`);

    const response = _.assign({
        code: code,
        message: message,
        data: data || {}
    });// , _.get(config, 'root', {})

    return this.status(401).json(response);
};
