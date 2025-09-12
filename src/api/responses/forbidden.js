"use strict";

/**
 * 403 (Forbidden) Response
 *
 * The request was a legal request, but the server is refusing to respond to it.
 * Unlike a 401 Unauthorized response, authenticating will make no difference.
 * Error code for user not authorized to perform the operation or the resource is unavailable for some reason.
 */

const _ = require('lodash');

exports.forbidden = function forbidden(data, config) {

    const code = _.get(config, 'code', 'E_FORBIDDEN');
    const message = _.get(config, 'message', `User not authorized to perform the operation`);

    const response = _.assign({
        code: code,
        message: message,
        data: data || {}
    });// , _.get(config, 'root', {})

    return this.status(403).json(response);
};
