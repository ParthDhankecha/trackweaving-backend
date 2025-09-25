const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { setResponses } = require('../api/responses/index');
const routes = require('../api/routes/indexRoute');

const expressApp = express();

expressApp.use(bodyParser.urlencoded({ extended: true }));
expressApp.use(bodyParser.json());

expressApp.use(express.static(path.join(__dirname, '..', 'public')));
expressApp.use(express.static(path.join(__dirname, '..', '..', 'client')));

expressApp.use(cors());
setResponses(expressApp);

expressApp.get('/dev', function (req, res, next) {
    console.log(`Request URL: ${req.originalUrl}`, req.params);
    return res.status(404).send({ message: 'Not Found' });
});

expressApp.use('/api', routes);

expressApp.get('*', function (req, res) {
    return res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});


module.exports = expressApp;