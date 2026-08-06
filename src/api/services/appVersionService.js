const utilService = require('../services/utilService');


const DEFAULT_PLATFORM = { min: 1, latest: 1, updateNote: '' };

function normalizePlatform(data = {}) {
    const platform = {
        min: Number(data.min ?? DEFAULT_PLATFORM.min),
        latest: Number(data.latest ?? DEFAULT_PLATFORM.latest),
        updateNote: typeof data.updateNote === 'string' ? data.updateNote.trim() : DEFAULT_PLATFORM.updateNote
    };

    if (!utilService.isNumber(platform.min, { min: 1 })) {
        throw global.config.message.BAD_REQUEST;
    }
    if (!utilService.isNumber(platform.latest, { min: 1 })) {
        throw global.config.message.BAD_REQUEST;
    }
    if (platform.min > platform.latest) {
        throw global.config.message.BAD_REQUEST;
    }

    return platform;
}
function hasPlatformChanged(current = {}, next = {}) {
    return current.min !== next.min || current.latest !== next.latest || (current.updateNote || '') !== (next.updateNote || '');
}
function toResponse(doc) {
    if (!doc) return null;
    const data = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: data._id,
        android: {
            min: data.android?.min ?? DEFAULT_PLATFORM.min,
            latest: data.android?.latest ?? DEFAULT_PLATFORM.latest,
            updateNote: data.android?.updateNote ?? DEFAULT_PLATFORM.updateNote
        },
        ios: {
            min: data.ios?.min ?? DEFAULT_PLATFORM.min,
            latest: data.ios?.latest ?? DEFAULT_PLATFORM.latest,
            updateNote: data.ios?.updateNote ?? DEFAULT_PLATFORM.updateNote
        },
        history: data.history || [],
    };
}


module.exports = {
    async getConfig(options = {}) {
        // Prefer the singleton config shape (android/ios). Ignore legacy per-platform docs.
        const query = appVersionModel.findOne({
            isDeleted: false,
            android: { $exists: true },
            ios: { $exists: true }
        }).sort({ createdAt: -1 });
        if (options.useLean) query.lean();
        return await query;
    },

    async create(data) {
        const existing = await this.getConfig({ useLean: true });
        if (existing) {
            throw global.config.message.APP_VERSION_ALREADY_EXIST;
        }

        const payload = {
            android: normalizePlatform(data.android),
            ios: normalizePlatform(data.ios),
            history: []
        };

        const appVersion = new appVersionModel(payload);
        const saved = await appVersion.save();
        return toResponse(saved);
    },

    async findOne(filter, options = {}) {
        options = {
            sort: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...options
        };

        const query = appVersionModel.findOne({ ...filter, isDeleted: false });
        if (options.sort) query.sort(options.sort);
        if (options.projection) query.select(options.projection);
        if (options.populate) query.populate(options.populate);
        if (options.useLean) query.lean();

        return await query;
    },

    async update(data) {
        const existing = await this.getConfig();
        if (!existing) {
            throw global.config.message.RECORD_NOT_FOUND;
        }

        const nextAndroid = data.android ? normalizePlatform({
            ...existing.android?.toObject?.() || existing.android, ...data.android
        }) : (
            existing.android?.toObject?.() || existing.android
        );
        const nextIos = data.ios ? normalizePlatform({
            ...existing.ios?.toObject?.() || existing.ios, ...data.ios
        }) : (
            existing.ios?.toObject?.() || existing.ios
        );

        const androidChanged = hasPlatformChanged(existing.android, nextAndroid);
        const iosChanged = hasPlatformChanged(existing.ios, nextIos);

        if (!androidChanged && !iosChanged) {
            return toResponse(existing);
        }

        const historyEntry = {
            android: existing.android?.toObject?.() || existing.android,
            ios: existing.ios?.toObject?.() || existing.ios,
            changedAt: new Date()
        };

        existing.android = nextAndroid;
        existing.ios = nextIos;
        existing.history = [historyEntry, ...(existing.history || [])];

        const saved = await existing.save();
        return toResponse(saved);
    },

    async getForceVersion() {
        const config = await this.getConfig({ useLean: true });
        if (!config) {
            return {
                android: { ...DEFAULT_PLATFORM },
                ios: { ...DEFAULT_PLATFORM }
            };
        }

        const response = toResponse(config);
        return {
            android: response.android,
            ios: response.ios
        };
    },

    toResponse
};