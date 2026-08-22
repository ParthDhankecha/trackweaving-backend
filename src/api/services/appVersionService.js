const { APP_VERSION } = require('../../config/constant/scoped/appVersion');
const utilService = require('./utilService');

const { FLAVORS, DEFAULT_VERSION } = APP_VERSION;


function badRequest() {
    throw global.config.message.BAD_REQUEST;
}

function isPositiveInt(value) {
    return Number.isInteger(value) && value >= 1;
}

function toPlain(doc) {
    if (!doc) return {};
    return typeof doc.toObject === 'function' ? doc.toObject({ flattenMaps: true }) : { ...doc };
}

function flavorsObject(flavors) {
    if (!flavors) return {};
    if (flavors instanceof Map) return Object.fromEntries(flavors);
    return { ...flavors };
}

function readPlatform(data = {}) {
    return {
        min: Number(data.min ?? DEFAULT_VERSION.min),
        latest: Number(data.latest ?? DEFAULT_VERSION.latest)
    };
}

function normalizePlatform(data = {}) {
    const platform = readPlatform(data);
    if (!isPositiveInt(platform.min) || !isPositiveInt(platform.latest) || platform.min > platform.latest) {
        badRequest();
    }
    return platform;
}

function filledFlavors(doc) {
    const stored = flavorsObject(toPlain(doc).flavors);
    const flavors = {};
    for (const name of FLAVORS) {
        const config = stored[name] || {};
        flavors[name] = {
            android: readPlatform(config.android),
            ios: readPlatform(config.ios)
        };
    }
    return flavors;
}

function normalizeFlavors(input, current = filledFlavors()) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) badRequest();

    const merged = { ...current };
    let hasValidFlavor = false;

    for (const [name, config] of Object.entries(input)) {
        const key = String(name).toLowerCase();
        if (!FLAVORS.includes(key) || !config || typeof config !== 'object' || Array.isArray(config)) continue;

        const prev = merged[key];
        merged[key] = {
            android: config.android ? normalizePlatform({ ...prev.android, ...config.android }) : prev.android,
            ios: config.ios ? normalizePlatform({ ...prev.ios, ...config.ios }) : prev.ios
        };
        hasValidFlavor = true;
    }

    if (!hasValidFlavor) badRequest();
    return merged;
}

function historyList(history = []) {
    return [...history]
        .map((item) => {
            const entry = typeof item.toObject === 'function' ? item.toObject() : item;
            return {
                _id: entry._id,
                build: entry.build,
                version: entry.version,
                updateNote: entry.updateNote || '',
                changedAt: entry.changedAt
            };
        })
        .sort((a, b) => b.build - a.build);
}

function normalizeHistory(data = {}) {
    const build = Number(data.build);
    const version = typeof data.version === 'string' ? data.version.trim() : '';
    if (!isPositiveInt(build) || !version) badRequest();
    return {
        build,
        version,
        updateNote: typeof data.updateNote === 'string' ? data.updateNote.trim() : '',
        changedAt: new Date()
    };
}

function assertUniqueBuild(history, build, excludeId) {
    const exists = (history || []).some((item) => (
        Number(item.build) === build && String(item._id) !== String(excludeId || '')
    ));
    if (exists) throw global.config.message.APP_VERSION_HISTORY_ALREADY_EXIST;
}

function toResponse(doc) {
    const data = toPlain(doc);
    return {
        _id: data._id || null,
        flavors: filledFlavors(data),
        history: historyList(data.history)
    };
}

async function getDoc({ lean = false, required = false } = {}) {
    const query = appVersionModel.findOne({ isDeleted: false }).sort({ createdAt: -1 });
    if (lean) query.lean();
    const doc = await query;
    if (required && !doc) throw global.config.message.RECORD_NOT_FOUND;
    return doc;
}


module.exports = {
    toResponse,

    getConfig(options = {}) {
        return getDoc({ lean: options.useLean });
    },

    async updateFlavors(flavorsInput) {
        const existing = await getDoc();
        const flavors = normalizeFlavors(flavorsInput, filledFlavors(existing));

        if (!existing) {
            return toResponse(await new appVersionModel({ flavors, history: [] }).save());
        }

        existing.flavors = flavors;
        return toResponse(await existing.save());
    },

    async addHistory(data) {
        const existing = await getDoc({ required: true });
        const entry = normalizeHistory(data);
        assertUniqueBuild(existing.history, entry.build);
        existing.history.push(entry);
        return toResponse(await existing.save());
    },

    async updateHistory(historyId, data) {
        if (!utilService.isValidObjectId(historyId)) badRequest();

        const existing = await getDoc({ required: true });
        const entry = existing.history.id(historyId);
        if (!entry) throw global.config.message.RECORD_NOT_FOUND;

        const next = normalizeHistory({
            build: data.build ?? entry.build,
            version: data.version ?? entry.version,
            updateNote: data.updateNote ?? entry.updateNote
        });
        assertUniqueBuild(existing.history, next.build, historyId);

        entry.set(next);
        return toResponse(await existing.save());
    },

    async deleteHistory(historyId) {
        if (!utilService.isValidObjectId(historyId)) badRequest();

        const existing = await getDoc({ required: true });
        const next = existing.history.filter((item) => String(item._id) !== String(historyId));
        if (next.length === existing.history.length) throw global.config.message.RECORD_NOT_FOUND;

        existing.history = next;
        return toResponse(await existing.save());
    },

    async getForceVersion(params = {}) {
        const flavor = String(params.flavor ?? '').toLowerCase();
        const version = Number(params.version ?? 1) || 1;
        const platform = String(params.platform ?? 'android').toLowerCase();

        const config = await getDoc({ lean: true });

        const versionConfig = config?.flavors?.[flavor]?.[platform] ?? DEFAULT_VERSION;
        const history = config?.history?.filter(
            (h) => h.build <= versionConfig.latest && h.build > version
        );

        return {
            ...versionConfig,
            updateNotes: history || []
        };
    }
};