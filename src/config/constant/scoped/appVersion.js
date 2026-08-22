module.exports = {
    APP_VERSION: {
        PLATFORMS: ['android', 'ios'],
        // Add new app variants here. Unknown device flavors fall back to `base`.
        FLAVORS: ['base', 'pickwell'],
        DEFAULT_FLAVOR: 'base',
        DEFAULT_VERSION: {
            min: 1,
            latest: 1
        }
    }
};