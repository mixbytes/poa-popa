'use strict';
const logger = require('./logger');

function send_response(res, obj) {
    if (res.req.x_id && typeof obj === 'object' && obj != null && !obj.x_id) {
        obj.x_id = res.req.x_id;
    }
    logger.log('[response] (' + res.req.log_prfx + ') ' + JSON.stringify(obj));
    const status = (obj.ok) ? 200 : 400;
    return res.status(status)
        .json(obj);
}

module.exports = send_response;
