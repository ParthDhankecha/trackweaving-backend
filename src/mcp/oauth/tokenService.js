const mcpConfig = require('../config');
const { generateToken, hashToken } = require('./crypto');

async function issueTokenPair({ clientId, scopes, resource, userContext }) {
    const accessToken = generateToken(32);
    const refreshToken = generateToken(32);
    const now = Date.now();
    const accessExpiresAt = new Date(now + mcpConfig.accessTokenTtlSeconds * 1000);
    const refreshExpiresAt = new Date(now + mcpConfig.refreshTokenTtlSeconds * 1000);

    await mcpOAuthTokenModel.create({
        tokenHash: hashToken(accessToken),
        tokenType: 'access',
        clientId,
        scopes,
        resource: resource || null,
        userId: userContext.userId,
        workspaceId: userContext.workspaceId,
        userType: userContext.userType,
        isMaster: userContext.isMaster,
        isOwner: userContext.isOwner,
        machineIds: userContext.machineIds || [],
        access: userContext.access || null,
        expiresAt: accessExpiresAt,
        refreshTokenHash: hashToken(refreshToken),
    });

    await mcpOAuthTokenModel.create({
        tokenHash: hashToken(refreshToken),
        tokenType: 'refresh',
        clientId,
        scopes,
        resource: resource || null,
        userId: userContext.userId,
        workspaceId: userContext.workspaceId,
        userType: userContext.userType,
        isMaster: userContext.isMaster,
        isOwner: userContext.isOwner,
        machineIds: userContext.machineIds || [],
        access: userContext.access || null,
        expiresAt: refreshExpiresAt,
    });

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: mcpConfig.accessTokenTtlSeconds,
        scope: scopes.join(' '),
    };
}

async function verifyAccessToken(token) {
    const row = await mcpOAuthTokenModel.findOne({
        tokenHash: hashToken(token),
        tokenType: 'access',
        revokedAt: null,
        expiresAt: { $gt: new Date() },
    }).lean();

    if (!row) {
        throw new Error('Invalid or expired access token');
    }

    return {
        token,
        clientId: row.clientId,
        scopes: row.scopes || mcpConfig.scopesSupported,
        expiresAt: Math.floor(new Date(row.expiresAt).getTime() / 1000),
        resource: row.resource ? new URL(row.resource) : undefined,
        extra: {
            userId: String(row.userId),
            workspaceId: String(row.workspaceId),
            type: row.userType,
            isMaster: row.isMaster,
            isOwner: row.isOwner,
            machineIds: (row.machineIds || []).map(String),
            access: row.access,
        },
    };
}

async function exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const refreshRow = await mcpOAuthTokenModel.findOne({
        tokenHash: hashToken(refreshToken),
        tokenType: 'refresh',
        clientId: client.client_id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
    }).lean();

    if (!refreshRow) {
        throw new Error('Invalid or expired refresh token');
    }

    if (resource && refreshRow.resource && resource.href !== refreshRow.resource) {
        throw new Error('Invalid resource for refresh token');
    }

    await mcpOAuthTokenModel.updateMany(
        { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
    await mcpOAuthTokenModel.updateOne(
        { tokenHash: hashToken(refreshToken) },
        { $set: { revokedAt: new Date() } }
    );

    const effectiveScopes = scopes?.length ? scopes : (refreshRow.scopes || mcpConfig.scopesSupported);
    return issueTokenPair({
        clientId: client.client_id,
        scopes: effectiveScopes,
        resource: resource?.href || refreshRow.resource,
        userContext: {
            userId: refreshRow.userId,
            workspaceId: refreshRow.workspaceId,
            userType: refreshRow.userType,
            isMaster: refreshRow.isMaster,
            isOwner: refreshRow.isOwner,
            machineIds: refreshRow.machineIds,
            access: refreshRow.access,
        },
    });
}

async function revokeToken(client, request) {
    const tokenHash = hashToken(request.token);
    const row = await mcpOAuthTokenModel.findOne({
        tokenHash,
        clientId: client.client_id,
        revokedAt: null,
    }).lean();
    if (!row) {
        return;
    }
    await mcpOAuthTokenModel.updateOne(
        { tokenHash },
        { $set: { revokedAt: new Date() } }
    );
    if (row.tokenType === 'refresh') {
        await mcpOAuthTokenModel.updateMany(
            { refreshTokenHash: tokenHash, revokedAt: null },
            { $set: { revokedAt: new Date() } }
        );
    }
}

module.exports = {
    issueTokenPair,
    verifyAccessToken,
    exchangeRefreshToken,
    revokeToken,
};
