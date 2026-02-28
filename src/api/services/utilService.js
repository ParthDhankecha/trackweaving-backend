const { hash } = require('bcrypt');
const moment = require('moment');

const { serverResponseRecordLimit } = require('../../config/env-vars');


module.exports = {
    log: (...args) => {
        console.log(new Date(), ...args);
    },
    infoLog: (data) => {
        console.log("\x1b[35m%s \x1b[32m%s\x1b[0m", new Date().toISOString(), data);
    },
    errLog: (data) => {
        /**
         * ESCAPE codes for symbols, forGround(font), background
         * Black   =  Fg("\x1b[30m") => Bg("\x1b[40m")
         * Red     =  Fg("\x1b[31m") => Bg("\x1b[41m")
         * Green   =  Fg("\x1b[32m") => Bg("\x1b[42m")
         * Yellow  =  Fg("\x1b[33m") => Bg("\x1b[43m")
         * Blue    =  Fg("\x1b[34m") => Bg("\x1b[44m")
         * Magenta =  Fg("\x1b[35m") => Bg("\x1b[45m")
         * Cyan    =  Fg("\x1b[36m") => Bg("\x1b[46m")
         * White   =  Fg("\x1b[37m") => Bg("\x1b[47m")
        */
        console.error("\x1b[35m%s \x1b[31m%s\x1b[0m", new Date().toISOString(), data);
    },
    warnLog: (data) => {
        console.warn("\x1b[35m%s \x1b[33m%s\x1b[0m", new Date().toISOString(), data);
    },

    /**
     * Generates a random OTP (One Time Password) of specified length.
     * @param {number} [optLength=6] - The length of the OTP to be generated. Default is 6.
     * @return {string} - A string representing the generated OTP.
     */
    generateOTP(optLength = 6) {
        let OTP = '';
        const allNumbers = '0123456789';
        for (let z = 0; z < optLength; z++) {
            OTP += allNumbers.charAt(Math.floor(Math.random() * allNumbers.length));
            if (OTP === '0') { z -= 1; OTP = ''; }
        };
        return OTP;
    },

    /**
     * @param {[string]} fields top level object keys in array of element to check params object
     * @param {{}} params object
     */
    checkRequiredParams: (fields, params) => {
        for (let field of fields) {
            if (typeof params[field] !== 'boolean' && params[field] !== 0 && !params[field]) {
                throw global.config.message.BAD_REQUEST;
            }
        }
    },

    /**
     * Generates a filter object for pagination based on the provided options.
     * @param {Object} options - The options for pagination.
     * @param {string} options.page - The current page number.
     * @param {string} options.limit - The number of records per page.
     * @return {Object} - The filter object containing skip and limit for pagination.
     * @example
     * const options = { page: '2', limit: '10' };
     * const filter = getFilter(options);
     */
    getFilter(options) {
        const page = parseInt(options.page, 10);
        const limit = parseInt(options.limit, 10);
        const filter = {
            skip: 0,
            limit: serverResponseRecordLimit
        };

        // Ensure valid numbers for page and limit
        if (!isNaN(page) && !isNaN(limit) && page >= 1 && limit > 0) {
            // If limit exceeds server max, use server limit
            if (limit > serverResponseRecordLimit) {
                filter.skip = (page - 1) * serverResponseRecordLimit;
                filter.limit = serverResponseRecordLimit;
            } else {
                filter.skip = (page - 1) * limit;
                filter.limit = limit;
            }
        }

        return filter;
    },

    /**
     * Generates a hash value for the given input data.
     * @param {string|Buffer} data - The data to hash
     * @param {string|number} saltOrRounds - Salt string or number of rounds
     * @returns {Promise<string>}
     */
    async generateHashValue(data, saltOrRounds = 10) {
        if (!(typeof data === 'string' || Buffer.isBuffer(data))) {
            throw new TypeError('Data must be a string or Buffer');
        }
        if (typeof data === 'string') {
            data = data.trim();
            if (data === '') throw new Error('Data cannot be empty string');
        }

        return await hash(data, saltOrRounds);
    },

    getCurrentTime() {
        return moment().valueOf();
    },

    getCurrentDateTime() {
        return moment().toISOString();
    },

    addTime(value, time = null, unit = 'minutes') {
        if (!time) {
            return moment().add(value, unit).toISOString();
        }
        return moment(time).add(value, unit).toISOString();
    },

    isDatePast(date, dateToCompare) {
        return moment(date).isBefore(dateToCompare);
    },

    isDateFuture(date, dateToCompare) {
        return moment(date).isAfter(dateToCompare);
    },

    // // Returns current timestamp in milliseconds
    // getCurrentTimestamp() {
    //     return moment().valueOf();
    // },

    // // Returns current date-time in ISO 8601 format (UTC)
    // getCurrentISODateTime() {
    //     return moment().utc().toISOString();
    // },

    // // Add time to current or given date and return ISO format
    // addTime(value, date = null, unit = 'minutes') {
    //     return moment(date || undefined).add(value, unit).utc().toISOString();
    // },

    // // Checks if a given date is before another date
    // isBefore(date, dateToCompare) {
    //     return moment(date).isBefore(dateToCompare);
    // },

    // // Checks if a given date is after another date
    // isAfter(date, dateToCompare) {
    //     return moment(date).isAfter(dateToCompare);
    // },

    generateRandomNumber(length) {
        let result = '';
        const characters = '0123456789';

        for (let i = 0; i < length; i++) {
            let randomNumber = Math.floor(Math.random() * characters.length);
            if (i === 0 && randomNumber === 0) randomNumber = 7;
            result += characters[randomNumber];
        }

        return result;
    },

    /**
     * Validates if a given value is a finite number and optionally checks if it falls within a range.
     * @param {number} value - The number to validate.
     * @param {object} [range={}] - Optional range limits.
     * @param {number} [range.min] - Minimum acceptable value (inclusive).
     * @param {number} [range.max] - Maximum acceptable value (inclusive).
     * @param {number} [range.exact] - Exact value to match.
     * @returns {boolean} `true` if the value is finite and within range, otherwise `false`.
     */
    isNumber(value, range = {}) {
        // unwrap Number objects
        if (value instanceof Number) value = value.valueOf();

        if (!Number.isFinite(value)) return false;

        const { min, max, exact } = range;
        if (min !== undefined) {
            if (!Number.isFinite(min)) return false;
            if (value < min) return false;
        }
        if (max !== undefined) {
            if (!Number.isFinite(max)) return false;
            if (value > max) return false;
        }
        if (exact !== undefined) {
            if (!Number.isFinite(exact)) return false;
            if (value !== exact) return false;
        }

        return true;
    },

    async deleteLocalFile(filePath) {
        return await new Promise((resolve, reject) => {
            const fullPath = path.resolve(filePath);
            try {
                fs.accessSync(fullPath); // Check if file exists
                fs.unlinkSync(fullPath); // Delete file
                console.log(`? File deleted: ${fullPath}`);
                resolve(true);
            } catch (err) {
                if (err.code === 'ENOENT') {
                    console.log(`?? File does not exist: ${fullPath}`);
                } else {
                    console.log(`? Error while deleting file:`, err?.message ?? err);
                }
                resolve(false);
            }
        });
    },

    async moveImageToDesign(filename) {
        try {
            const uploadDir = path.join(__dirname, '..', 'public', 'upload');
            const designDir = path.join(__dirname, '..', 'public', 'design');

            // Ensure design folder exists
            await fs.mkdir(designDir, { recursive: true });

            const oldPath = path.join(uploadDir, filename);
            const newPath = path.join(designDir, filename);

            // Move (copy + delete original)
            await fs.rename(oldPath, newPath);

            // Return relative path to store in DB
            return `/design/${filename}`;

        } catch (error) {
            console.error("Error moving file:", error);
            throw error;
        }
    }
}