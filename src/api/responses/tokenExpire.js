"use strict";

/**
 * 403 (Forbidden) Response
 *
 * The request was a legal request, but the server is refusing to respond to it.
 * Unlike a 401 Unauthorized response, authenticating will make no difference.
 * Error code for user not authorized to perform the operation or the resource is unavailable for some reason.
 */

const _ = require('lodash');

exports.tokenExpire = function tokenExpire(data, config) {

    const code = _.get(config, 'code', 'E_TOKEN_EXPIRED');
    const message = _.get(config, 'message', `Token expired.`);

    const response = _.assign({
        code: code,
        message: message,
        data: data || null
    });// , _.get(config, 'root', {})

    const status = config.status || 401;
    return this.status(status).json(response);
};
