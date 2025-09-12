'use strict';

/**
 * 500 (Internal Server Error) Response
 *
 * A generic error message, given when no more specific message is suitable.
 * The general catch-all error when the server-side throws an exception.
 */

exports.serverError = function serverError(config = {}, data = null) {
    let response = global.config.message.SERVER_ERROR;

    const defaultResponses = global.config.DEFAULT_ERROR_RESPONSE_CODE;
    const configCode = config.code;

    if (configCode) {
        if (defaultResponses.indexOf(configCode) > -1) {
            response = config;
        } else {
            switch (configCode) {
                case 'E_INVALID_NEW_RECORD':
                    response = global.config.message.CREATE_FAILED;
                    break;
                default:
                    response = global.config.message.SERVER_ERROR;
            }
        }
    }

    const statusCode = config.status || 500;
    return this.status(statusCode).json(response);
};
