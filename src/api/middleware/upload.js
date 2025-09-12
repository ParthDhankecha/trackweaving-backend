const multer = require('multer');
const { join, extname } = require('path');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        switch (file.fieldname) {
            case 'upload':
                cb(null, join(__dirname, '..', '..', 'public', 'upload'));
                break;
            default:
                cb(null, join(__dirname, '..', '..', 'public'));
                break;
        }
    },
    filename: function (req, file, cb) {
        /** create array length of 8 and fill with null value, get random value 0 to 9 and convert into hexadecimal, convert string from array and add new date and time */
        const randomName = Array(8).fill(null).map(() => (Math.round(Math.random() * 9)).toString(16)).join('') + (new Date().valueOf());
        cb(null, `${randomName}${extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|svg\+xml)$/.test(file.mimetype)) {
        cb(null, true);
    } else {
        /** new Error('Invalid mime type.'); */
        cb('INVALID_MIME_TYPE');
    }
}

const upload = multer({
    /** Maximum file upload size 5(Mb) */
    // limits: { fileSize: 1024 * 1024 * 2 },
    fileFilter: fileFilter,
    storage: storage,
});


const uploadSingleOrArray = (fieldName, maxCount = 1) => {

    return (req, res, next) => {
        if (!fieldName.trim()) fieldName = 'upload';

        (maxCount <= 1 ? upload.single(fieldName) : upload.array(fieldName, maxCount))(req, res, function (err) {
            if (err) {
                if (err instanceof multer.MulterError) {
                    /** error from multer validation */
                    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                        return res.badRequest(null, global.config.message.FILE_LIMIT_EXCEEDED);
                    } else if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.badRequest(null, global.config.message.FILE_TOO_LARGE);
                    }
                } else if (err === 'INVALID_MIME_TYPE') {
                    return res.badRequest(null, global.config.message.INVALID_MIME_TYPE);
                }
            } else {
                return next(err);
            }
            next();
        });
    }
};


const uploadFields = (fields = [{ name: 'upload', maxCount: 5 }]) => {

    const fieldsToSave = fields.filter(field => 'name' in field).map(field => ({ name: field.name, ...(field.maxCount ? { maxCount: field.maxCount } : undefined) }));

    return (req, res, next) => {
        try {

            upload.fields(fieldsToSave)(req, res, function (err) {

                if (err instanceof multer.MulterError) {
                    /** error from multer validation */
                    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                        return res.badRequest(null, global.config.message.FILE_LIMIT_EXCEEDED_OR_FIELD_UNEXPECTED);
                    } else if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.badRequest(null, global.config.message.FILE_TOO_LARGE);
                    } else {
                        return res.badRequest(null, global.config.message.BAD_REQUEST);
                    }
                } else if (err) {
                    if (err === 'INVALID_MIME_TYPE')
                        return res.badRequest(null, global.config.message.INVALID_MIME_TYPE);

                    return res.badRequest(null, global.config.message.BAD_REQUEST);
                }
                next();
            });

        } catch (error) {
            console.log(error);
            return res.serverError(error);
        }
    }
};



module.exports = {
    uploadSingleOrArray,
    uploadFields
};