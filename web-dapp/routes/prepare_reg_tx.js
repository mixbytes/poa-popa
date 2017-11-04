'use strict';

const logger = require('../logger');
const express = require('express');
const config = require('../server-config');
const sign = require('../server-lib/sign');
const generate_code = require('../server-lib/generate_code');
const validate = require('../server-lib/validations').validate;
const normalize = require('../server-lib/validations').normalize;
const db = require('../server-lib/session_store');
const send_response = require('../server-lib/send_response');
const recalc_price = require('../server-lib/recalc_price');

module.exports = function (opts) {
    var router = express.Router();
    router.post('/prepareRegTx', function (req, res) {
        var prelog = req.log_prfx + '[prepareRegTx] ';
        if (!req.body) {
            logger.log(prelog + 'request body empty');
            return send_response(res, { ok: false, err: 'request body: empty' });
        }

        var params = {};
        var verr;

        // wallet
        verr = validate.wallet(config.web3, req.body.wallet);
        if (verr) {
            logger.log(prelog + 'wallet: ' + verr);
            return send_response(res, { ok: false, err: 'wallet: ' + verr });
        }
        var wallet = req.body.wallet;

        // name
        verr = validate.string(req.body.name);
        if (verr) {
            logger.log(prelog + 'name: ' + verr);
            return send_response(res, { ok: false, err: 'name: ' + verr });
        }
        params.name = normalize.string(req.body.name);

        // country
        verr = validate.string(req.body.country);
        if (verr) {
            logger.log(prelog + 'country: ' + verr);
            return send_response(res, { ok: false, err: 'country: ' + verr });
        }
        params.country = normalize.string(req.body.country);

        // state
        verr = validate.string(req.body.state);
        if (verr) {
            logger.log(prelog + 'state: ' + verr);
            return send_response(res, { ok: false, err: 'state: ' + verr });
        }
        params.state = normalize.string(req.body.state);

        // city
        verr = validate.string(req.body.city);
        if (verr) {
            logger.log(prelog + 'city: ' + verr);
            return send_response(res, { ok: false, err: 'city: ' + verr });
        }
        params.city = normalize.string(req.body.city);

        // address
        verr = validate.string(req.body.address);
        if (verr) {
            logger.log(prelog + 'address: ' + verr);
            return send_response(res, { ok: false, err: 'address: ' + verr });
        }
        params.address = normalize.string(req.body.address);

        // zip
        verr = validate.string(req.body.zip);
        if (verr) {
            logger.log(prelog + 'zip: ' + verr);
            return send_response(res, { ok: false, err: 'zip: ' + verr });
        }
        params.zip = normalize.string(req.body.zip);

        logger.log(prelog + 'normalized params: ' + JSON.stringify(params));

        // generate confimration confirmation_code_plain
        var confirmation_code_plain = generate_code();
        logger.log(prelog + 'confirmation_code_plain: ' + confirmation_code_plain);
        var sha3cc = config.web3.sha3(confirmation_code_plain);

        // combine parameters and sign them
        var hex_params = {};
        Object.keys(params).forEach(p => { hex_params[p] = Buffer.from(params[p], 'utf8') });
        logger.log(prelog + 'combining into text2sign hex string:');
        logger.log(prelog + 'wallet:        ' + wallet);
        logger.log(prelog + 'hex name:      0x' + hex_params.name.toString('hex'));
        logger.log(prelog + 'hex country:   0x' + hex_params.country.toString('hex'));
        logger.log(prelog + 'hex state:     0x' + hex_params.state.toString('hex'));
        logger.log(prelog + 'hex city:      0x' + hex_params.city.toString('hex'));
        logger.log(prelog + 'hex address:   0x' + hex_params.address.toString('hex'));
        logger.log(prelog + 'hex zip:       0x' + hex_params.zip.toString('hex'));
        logger.log(prelog + 'sha3(cc):      ' + sha3cc);
        var text2sign = wallet + Buffer.concat([
            hex_params.name,
            hex_params.country,
            hex_params.state,
            hex_params.city,
            hex_params.address,
            hex_params.zip,
            Buffer.from(sha3cc.substr(2), 'hex')
        ]).toString('hex');
        logger.log(prelog + '=> text2sign: ' + text2sign);

        try {
            var sign_output = sign(config.web3, text2sign);
            logger.log(prelog + 'sign() output: ' + JSON.stringify(sign_output));
            var session_key = Math.random();
            logger.log(prelog + 'setting session_key: ' + session_key);
            db.set(session_key, { wallet, date: new Date, confirmation_code_plain }, function (err) {
                if (err) {
                    logger.error(prelog + 'error setting session_key: ' + err);
                    return send_response(res, { ok: false, err: 'error setting session_key' });
                }
                return send_response(res, {
                    ok: true,
                    result: {
                        wallet: wallet,
                        params: params,
                        confirmation_code_sha3: sha3cc,
                        v: sign_output.v,
                        r: sign_output.r,
                        s: sign_output.s,
                        session_key: session_key,
                    },
                });
            });
        }
        catch (e) {
            logger.error(prelog + 'exception in sign(): ' + e.stack);
            return send_response(res, {
                ok: false,
                err: 'exception occured during signature calculation',
            });
        }
    });

    return router;
};
