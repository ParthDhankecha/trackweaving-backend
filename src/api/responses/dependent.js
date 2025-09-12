"use strict";

/**
 * 400 (Bad Request) Response
 *
 * The request cannot be fulfilled due to bad syntax.
 * General error when fulfilling the request would cause an invalid state.
 * Domain validation errors, missing data, etc.
 */

const _ = require('lodash');

exports.dependent = function dependent(data, config) {

    const code = _.get(config, 'code', 'E_DEPENDENT');
    const message = _.get(config, 'message', `The request cannot be fulfilled due to dependencies of other module(s).`);

    const response = _.assign({
        code: code,
        message: message,
        data: data || {}
    });// , _.get(config, 'root', {})

    return this.status(200).json(response);
};
