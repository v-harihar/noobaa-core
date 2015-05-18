'use strict';
require('../util/panic');

// newrelic monitoring should load first
if (process.env.NEW_RELIC_LICENSE_KEY) {
    require('newrelic');
}

if (process.env.NODETIME_ACCOUNT_KEY) {
    require('nodetime').profile({
        accountKey: process.env.NODETIME_ACCOUNT_KEY
    });
}

// dump heap with kill -USR2 <pid>
require('heapdump');

// important - dot settings should run before any require() that might use dot
// or else the it will get mess up (like the email.js code)
var dot_engine = require('noobaa-util/dot_engine');
var _ = require('lodash');
var Q = require('q');
var path = require('path');
var http = require('http');
var mongoose = require('mongoose');
var dotenv = require('dotenv');
var express = require('express');
var express_favicon = require('serve-favicon');
var express_morgan_logger = require('morgan');
var express_body_parser = require('body-parser');
var express_cookie_parser = require('cookie-parser');
var express_cookie_session = require('cookie-session');
var express_method_override = require('method-override');
var express_compress = require('compression');
var config = require('../../config.js');
var dbg = require('noobaa-util/debug_module')(__filename);
var mongoose_logger = require('noobaa-util/mongoose_logger');
var s3app = require('../s3/app');

if (!process.env.PORT) {
    console.log('loading .env file ( no foreman ;)');
    dotenv.load();
}

// address means the address of the server as reachable from the internet
process.env.ADDRESS = process.env.ADDRESS || 'http://localhost:5001';

var rootdir = path.join(__dirname, '..', '..');
var dev_mode = (process.env.DEV_MODE === 'true');
var debug_mode = (process.env.DEBUG_MODE === 'true');

// connect to the database
if (debug_mode) {
    mongoose.set('debug', mongoose_logger(dbg.log0.bind(dbg)));
}
mongoose.connection.on('error', function(err) {
    console.error('mongoose connection error:', err);
});
mongoose.connection.once('open', function() {
    // call ensureIndexes explicitly for each model
    return Q.all(_.map(mongoose.modelNames(), function(model_name) {
        return Q.npost(mongoose.model(model_name), 'ensureIndexes');
    }));
});
mongoose.connect(
    process.env.MONGOHQ_URL ||
    process.env.MONGOLAB_URI ||
    'mongodb://localhost/nbcore');

// create express app
var app = express();
var web_port = process.env.PORT || 5001;
var server = http.createServer(app);
app.set('port', web_port);

// setup view template engine with doT
var views_path = path.join(rootdir, 'src', 'views');
app.set('views', views_path);
app.engine('html', dot_engine(views_path));

// copied from s3rver. not sure why. but copy.
app.disable('x-powered-by');


////////////////
// MIDDLEWARE //
////////////////

// configure app middleware handlers in the order to use them

app.use(express_favicon(path.join(rootdir, 'images', 'noobaa_icon.ico')));
app.use(express_morgan_logger(dev_mode ? 'dev' : 'combined'));
app.use(function(req, res, next) {
    // HTTPS redirect:
    // since we want to provide secure and certified connections
    // for the entire application, so once a request for http arrives,
    // we redirect it to https.
    // it was suggested to use the req.secure flag to check that.
    // however our nodejs server is always http so the flag is false,
    // and on heroku only the router does ssl,
    // so we need to pull the heroku router headers to check.
    var fwd_proto = req.get('X-Forwarded-Proto');
    // var fwd_port = req.get('X-Forwarded-Port');
    // var fwd_from = req.get('X-Forwarded-For');
    // var fwd_start = req.get('X-Request-Start');
    if (fwd_proto === 'http') {
        var host = req.get('Host');
        return res.redirect('https://' + host + req.url);
    }
    return next();
});
app.use(express_cookie_parser(process.env.COOKIE_SECRET));
app.use(express_body_parser.json());
app.use(express_body_parser.raw());
app.use(express_body_parser.text());
app.use(express_body_parser.urlencoded({
    extended: false
}));
app.use(express_method_override());
app.use(express_cookie_session({
    key: 'noobaa_session',
    secret: process.env.COOKIE_SECRET,
    // TODO: setting max-age for all sessions although we prefer only for /auth.html
    // but express/connect seems broken to accept individual session maxAge,
    // although documented to work. people also report it fails.
    maxage: 356 * 24 * 60 * 60 * 1000 // 1 year
}));
app.use(express_compress());


/////////
// RPC //
/////////

// register RPC services and transports
var server_rpc = require('./server_rpc');
server_rpc.register_http_transport(app);
server_rpc.register_ws_transport(server);
// server_rpc.register_n2n_transport();


////////////
// S3 APP //
////////////

app.use('/s3', s3app({}));

////////////
// ROUTES //
////////////

// agent package json
app.get('/agent/package.json', function(req, res) {
    res.status(200).send({
        name: 'agent',
        engines: {
            node: '0.10.33'
        },
        scripts: {
            start: 'node node_modules/noobaa-agent/agent/agent_cli.js ' +
                ' --prod --address ' + process.env.ADDRESS
        },
        dependencies: {
            'noobaa-agent': process.env.ADDRESS + '/public/noobaa-agent.tar.gz'
        }
    });
});


// setup pages

function page_context(req) {
    var data = {};
    return {
        data: data
    };
}

app.get('/console/*', function(req, res) {
    return res.render('console.html', page_context(req));
});
app.get('/console', function(req, res) {
    return res.redirect('/console/');
});

app.get('/', function(req, res) {
    return res.redirect('/console/');
});

// Upgrade checks
app.get('/get_latest_version*', function(req, res) {
    if (req.params[0].indexOf('&curr=') !== -1) {
        try {
            var query_version = req.params[0].substr(req.params[0].indexOf('&curr=') + 6);
            var ret_version = '';

            if (!is_latest_version(query_version)) {
                ret_version = config.on_premise.base_url + process.env.CURRENT_VERSION + '/' + config.on_premise.nva_part;
            }

            res.status(200).send({
                version: ret_version,
            });
        } catch (err) {}
    }
    res.status(400).send({});
});



////////////
// STATIC //
////////////

// using router before static files to optimize -
// since we usually have less routes then files, and the routes are in memory.

function cache_control(seconds) {
    var millis = 1000 * seconds;
    return function(req, res, next) {
        res.setHeader("Cache-Control", "public, max-age=" + seconds);
        res.setHeader("Expires", new Date(Date.now() + millis).toUTCString());
        return next();
    };
}

// setup static files
app.use('/public/', cache_control(dev_mode ? 0 : 10 * 60)); // 10 minutes
app.use('/public/', express.static(path.join(rootdir, 'build', 'public')));
app.use('/public/images/', cache_control(dev_mode ? 3600 : 24 * 3600)); // 24 hours
app.use('/public/images/', express.static(path.join(rootdir, 'images')));
app.use('/', express.static(path.join(rootdir, 'public')));



// error handlers should be last
// roughly based on express.errorHandler from connect's errorHandler.js
app.use(error_404);
app.use(function(err, req, res, next) {
    console.error('ERROR:', err);
    var e;
    if (dev_mode) {
        // show internal info only on development
        e = err;
    } else {
        e = _.pick(err, 'statusCode', 'message', 'reload');
    }
    e.statusCode = err.statusCode || res.statusCode;
    if (e.statusCode < 400) {
        e.statusCode = 500;
    }
    res.status(e.statusCode);

    if (can_accept_html(req)) {
        var ctx = { //common_api.common_server_data(req);
            data: {}
        };
        if (dev_mode) {
            e.data = _.extend(ctx.data, e.data);
        } else {
            e.data = ctx.data;
        }
        return res.render('error.html', e);
    } else if (req.accepts('json')) {
        return res.json(e);
    } else {
        return res.type('txt').send(e.message || e.toString());
    }
});

function error_404(req, res, next) {
    return next({
        status: 404, // not found
        message: 'We dug the earth, but couldn\'t find ' + req.originalUrl
    });
}

/*
function error_403(req, res, next) {
    console.log('NO USER', req.originalMethod, req.originalUrl);
    if (can_accept_html(req)) {
        return res.redirect(URL.format({
            pathname: '/login/',
            query: {
                state: req.originalUrl
            }
        }));
    }
    var err = {
        status: 403, // forbidden
        message: 'NO USER',
        reload: true
    };
    return next(err);
}

function error_501(req, res, next) {
    return next({
        status: 501, // not implemented
        message: 'Working on it... ' + req.originalUrl
    });
}
*/

// decide if the client can accept html reply.
// the xhr flag in the request (X-Requested-By header) is not commonly sent
// see https://github.com/angular/angular.js/commit/3a75b1124d062f64093a90b26630938558909e8d
// the accept headers from angular http contain */* so will match anything.
// so finally we fallback to check the url.

function can_accept_html(req) {
    return !req.xhr && req.accepts('html') && req.originalUrl.indexOf('/api/') !== 0;
}

// Check if given version is the latest version, or are there newer ones
// Version is in the form of X.Y.Z, start checking from left to right
function is_latest_version(query_version) {
    var srv_version = process.env.CURRENT_VERSION;
    console.log('Checking version', query_version, 'against', srv_version);

    if (query_version === srv_version) {
        return true;
    }

    var srv_version_parts = srv_version.toString().split('.');
    var query_version_parts = query_version.split('.');

    var len = Math.min(srv_version_parts.length, query_version_parts.length);

    // Compare common parts
    for (var i = 0; i < len; i++) {
        //current part of server is greater, query version is outdated
        if (parseInt(srv_version_parts[i]) > parseInt(query_version_parts[i])) {
            return false;
        }

        if (parseInt(srv_version_parts[i]) < parseInt(query_version_parts[i])) {
            console.error('BUG?! Queried version (', query_version, ') is higher than server version(',
                srv_version, ') ! How can this happen?');
            return true;
        }
    }

    // All common parts are equal, check if there are tailing version parts
    if (srv_version_parts.length > query_version_parts.length) {
        return false;
    }

    if (srv_version_parts.length < query_version_parts.length) {
        console.error('BUG?! Queried version (', query_version, ') is higher than server version(',
            srv_version, '), has more tailing parts! How can this happen?');
        return true;
    }

    return true;
}



// start http server
server.listen(web_port, function() {
    console.log('Web server on port ' + web_port);
});
