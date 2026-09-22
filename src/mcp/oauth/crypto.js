const crypto = require('crypto');

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function generateClientId() {
    return `tw_mcp_${generateToken(16)}`;
}

function generateClientSecret() {
    return generateToken(32);
}

function timingSafeEqualString(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
    hashToken,
    generateToken,
    generateClientId,
    generateClientSecret,
    timingSafeEqualString,
};
