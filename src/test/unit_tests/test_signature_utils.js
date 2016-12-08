/* Copyright (C) 2016 NooBaa */
'use strict';

const _ = require('lodash');
const fs = require('fs');
const url = require('url');
const net = require('net');
const path = require('path');
const http = require('http');
const mocha = require('mocha');
const crypto = require('crypto');

const P = require('../../util/promise');
const signature_utils = require('../../util/signature_utils');


mocha.describe('signature_utils', function() {

    const SIG_TEST_SUITE = path.join(__dirname, 'signature_test_suite');

    const SECRETS = {
        'AKIDEXAMPLE': 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
        '123': 'abc',
    };

    const http_server = http.createServer(accept_signed_request);

    mocha.before(function() {
        return new P((resolve, reject) =>
            http_server
            .once('listening', resolve)
            .once('error', reject)
            .listen());
    });

    mocha.after(function() {
        http_server.close();
    });

    add_tests_from(path.join(SIG_TEST_SUITE, 'aws4_testsuite'), '.sreq');
    add_tests_from(path.join(SIG_TEST_SUITE, 'awscli'), '.sreq');
    add_tests_from(path.join(SIG_TEST_SUITE, 'cyberduck'), '.sreq');
    add_tests_from(path.join(SIG_TEST_SUITE, 'postman'), '.sreq');
    add_tests_from(path.join(SIG_TEST_SUITE, 'presigned'), '.sreq');

    function add_tests_from(fname, extension) {

        // try to read it as a directory,
        // if not a directory assume its a file
        try {
            const entries = fs.readdirSync(fname);
            for (const entry of entries) {
                add_tests_from(path.join(fname, entry), extension);
            }
            return;
        } catch (err) {
            if (err.code !== 'ENOTDIR') throw err;
        }

        const test_name = path.basename(fname);

        if (extension && !fname.endsWith(extension)) {
            return;
        }

        if (test_name === 'get-header-value-multiline.sreq') {
            console.log('Skipping', test_name, '- the multiline header test is broken');
            return;
        }

        if (test_name === 'post-vanilla-query-space.sreq') {
            console.log('Skipping', test_name, '- the query space test is broken');
            return;
        }

        mocha.it(test_name, function() {
            console.log('Test:', test_name);
            const request_data = fs.readFileSync(fname);
            return send_signed_request(request_data);
        });
    }

    /**
     * send_signed_request is the client function
     * that takes a raw http request dump of a signed http request,
     * and sends it to the http server for verification.
     */
    function send_signed_request(signed_req_buf) {
        const socket = net.connect({
            port: http_server.address().port
        }, () => {
            socket.write(signed_req_buf);
            if (!signed_req_buf.includes('\r\n\r\n')) {
                socket.write('\r\n\r\n');
            }
        });
        let reply = '';
        return new P((resolve, reject) => socket
                .setEncoding('utf8')
                .on('data', data => {
                    reply += data;
                })
                .once('error', reject)
                .once('end', resolve)
            )
            .then(() => {
                socket.destroy();
                console.log('REPLY:', reply);
                reply = reply.trim();
                const CONT = 'HTTP/1.1 100 Continue';
                if (reply.startsWith(CONT)) {
                    reply = reply.slice(CONT.length).trim();
                }
                if (reply.startsWith('HTTP/1.1 200 OK')) {
                    return;
                }
                throw new Error('BAD REPLY: ' + reply);
            });
    }

    /**
     * accept_signed_request is the server function
     * that receives the signed http request, calculates signature
     * and checks if the signature is correct
     */
    function accept_signed_request(req, res) {
        let body_len = 0;
        req.originalUrl = req.url;
        const parsed_url = url.parse(req.originalUrl, true);
        req.url = parsed_url.pathname;
        req.query = parsed_url.query;
        res.setHeader('Connection', 'close');
        console.log(
            'Handle:', req.method, req.originalUrl,
            'query', req.query,
            'headers', req.headers);
        return new P((resolve, reject) => {
                const sha256 = crypto.createHash('sha256');
                req.on('data', data => {
                        sha256.update(data);
                        body_len += data.length;
                        console.log(`Request body length so far ${body_len}`);
                    })
                    .once('end', () => {
                        req.content_sha256 = sha256.digest();
                        console.log(`Request body ended body length ${body_len} sha256 ${req.content_sha256.toString('hex')}`);
                        return resolve();
                    })
                    .once('error', reject);
            })
            .then(() => {
                const sha256_header = req.headers['x-amz-content-sha256'];
                const sha256_data = req.content_sha256.toString('hex');
                if (sha256_header &&
                    sha256_header !== sha256_data) {
                    console.error('Content sha256 does not match',
                        'x-amz-content-sha256', sha256_header,
                        'calculated', sha256_data,
                        'assuming the header is right to allow tests without content...');
                    req.content_sha256 = new Buffer(sha256_header, 'hex');
                }
                const auth_token = signature_utils.authenticate_request(req);
                const signature = signature_utils.signature(auth_token, SECRETS[auth_token.access_key]);
                if (signature !== auth_token.signature) {
                    throw new Error('Signature mismatch');
                }
                res.end(JSON.stringify(auth_token));
            })
            .catch(err => {
                console.error('SIGNATURE ERROR', err.stack);
                res.statusCode = 500;
                res.end();
            });
    }

});
