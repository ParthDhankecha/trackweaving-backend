const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { setResponses } = require('../api/responses/index');
const routes = require('../api/routes/indexRoute');

const expressApp = express();

if (process.env.MCP_TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    expressApp.set('trust proxy', 1);
}

expressApp.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
expressApp.use(bodyParser.json({ limit: '10mb' }));

expressApp.use(express.static(path.join(__dirname, '..', 'public')));
expressApp.use(express.static(path.join(__dirname, '..', 'public', 'operators')));
expressApp.use(express.static(path.join(__dirname, '..', '..', 'client')));

expressApp.use(cors());
setResponses(expressApp);

expressApp.get('/dev', function (req, res, next) {
    console.log(`Request URL: ${req.originalUrl}`, req.params);
    return res.status(404).send({ message: 'Not Found' });
});

expressApp.use('/api', routes);

try {
    const { mountTrackWeavingMcp } = require('../mcp/mount');
    mountTrackWeavingMcp(expressApp);
} catch (error) {
    // eslint-disable-next-line no-console
    console.error('TrackWeaving MCP not mounted:', error.message);
    if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error(error.stack);
    }
}

expressApp.get('*', function (req, res, next) {
    if (
        req.path.startsWith('/mcp')
        || req.path.startsWith('/oauth')
        || req.path.startsWith('/.well-known')
        || req.path.startsWith('/docs/mcp')
        || req.path === '/authorize'
        || req.path === '/token'
        || req.path === '/register'
        || req.path === '/revoke'
    ) {
        return next();
    }
    return res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});


module.exports = expressApp;