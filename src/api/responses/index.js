const fs = require('fs');


exports.setResponses = (app) => {
    const responseFiles = fs.readdirSync(__dirname);
    for (const file of responseFiles) {
        if (file != 'index.js' && file.slice(-3) == '.js') {
            const fileName = file.replace('.js', '');
            const fileObject = require('./' + file);
            app.response[fileName] = fileObject[fileName];
        }
    }
    return 'Custom responses set successfully';
};