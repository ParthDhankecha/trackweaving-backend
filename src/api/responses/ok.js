'use strict';

/**
 * 200 (OK) Response
 *
 * General status code. Most common code used to indicate success.
 * The actual response will depend on the request method used.
 * In a GET request, the response will contain an entity corresponding to the requested resource.
 * In a POST request the response will contain an entity describing or containing the result of the
    action.
 */

const _ = require('lodash');

exports.ok = function ok(data, config) {

    // if (!_.isArray(data) && _.isObject(data)) {
    //     data = [data];
    // }

    const code = _.get(config, 'code', 'OK');
    const message = _.get(config, 'message', 'Operation is successfully executed');

    const response = _.assign({
        code: code,
        message: message,
        data: data || (_.isArray(data) ? [] : {})
    });
    // }, _.get(config, 'root', {}));

    return this.status(200).json(response);
};
