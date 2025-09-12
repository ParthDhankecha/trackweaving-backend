'use strict';

/**
 * 400 (Bad Request) Response
 *
 * The request cannot be fulfilled due to bad syntax.
 * General error when fulfilling the request would cause an invalid state.
 * Domain validation errors, missing data, etc.
 */

const _ = require('lodash');

exports.badRequest = function badRequest(data, config) {
    
    const code = _.get(config, 'code', 'E_BAD_REQUEST');
    const message = _.get(config, 'message', 'The request cannot be fulfilled due to bad syntax');

    const response = {
        code: code,
        message: message,
        data: data || {}
    };

    return this.status(400).json(response);
};
