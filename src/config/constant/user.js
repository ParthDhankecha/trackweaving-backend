const TYPE = {
    SUPER_ADMIN: 0,
    ADMIN: 1,
    MASTER: 2
};

module.exports = {
    USERS: {
        TYPE,
        TYPE_OPTIONS: [
            { value: TYPE.ADMIN, label: 'Admin' },
            { value: TYPE.MASTER, label: 'Master' }
        ]
    }
};