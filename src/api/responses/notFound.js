"use strict";

/**
 * 404 (Not Found) Response
 *
 * The requested resource could not be found but may be available again in the future.
 * Subsequent requests by the client are permissible.
 * Used when the requested resource is not found, whether it doesn't exist.
 */

const _ = require('lodash');

exports.notFound = function notFound(data, config) {

    const code = _.get(config, 'code', 'E_NOT_FOUND');
    const message = _.get(config, 'message', `The requested resource could not be found but may be available again in the future`);

    const response = _.assign({
        code: code,
        message: message,
        data: data || {}
    });// , _.get(config, 'root', {})

    return this.status(404).json(response);
};
