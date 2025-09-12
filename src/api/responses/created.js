"use strict";

/**
 * 201 (Created) Response
 *
 * The request has been fulfilled and resulted in a new resource being created.
 * Successful creation occurred (via either POST or PUT).
 * Set the Location header to contain a link to the newly-created resource (on POST).
 * Response body content may or may not be present.
 */

const _ = require('lodash');

exports.created = function created(data, config) {

    const code = _.get(config, 'code', 'CREATED');
    const message = _.get(config, 'message', `The request has been fulfilled and resulted in a new resource being created`);

    const response = _.assign({
        code: code,
        message: message,
        data: data || {}
    });// , _.get(config, 'root', {})

    return this.status(201).json(response);
};
