module.exports = {
    DEFAULT_ERROR_RESPONSE_CODE: [
        'E_DUPLICATE',
        'E_FORBIDDEN',
        'E_UNAUTHORIZED',
        'E_BAD_REQUEST',
        'E_NOT_FOUND',
        'E_TOKEN_EXPIRED',
        'E_USER_NOT_FOUND',
        'UNPROCESSABLE_ENTITY',
    ],
    SEEDER_DATA_CONFIG: [
        {
            fileName: 'setupConfig',
            uniqueField: 'projectName',
            model: 'setupConfigModel'
        },
        {
            fileName: 'projectConfig',
            uniqueField: 'projectName',
            model: 'projectConfigModel'
        },
        // {
        //     fileName: 'users',
        //     uniqueField: 'userType',
        //     model: 'userModel'
        // }
    ],
    API_KEY: '4d38b5078b4bcd8122e3af614b1239379de1205d85e48808555eb8ca13019f21'
};