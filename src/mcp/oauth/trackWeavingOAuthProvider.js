const mcpConfig = require('../config');
const { MongoOAuthClientsStore } = require('./mongoClientsStore');
const { generateToken, hashToken } = require('./crypto');
const tokenService = require('./tokenService');
const { renderConsentPage } = require('./consentPage');

class TrackWeavingOAuthProvider {
    constructor(options = {}) {
        this.validateResource = options.validateResource;
        this.clientsStore = new MongoOAuthClientsStore();
        this._pendingAuthorizations = new Map();
    }

    async authorize(client, params, res) {
        if (!client.redirect_uris.includes(params.redirectUri)) {
            throw new Error('Unregistered redirect_uri');
        }

        const authRequestId = generateToken(16);
        this._pendingAuthorizations.set(authRequestId, {
            client,
            params,
            createdAt: Date.now(),
        });

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).type('html').send(renderConsentPage({
            authRequestId,
            clientName: client.client_name || client.client_id,
            scopes: params.scopes?.length ? params.scopes : mcpConfig.scopesSupported,
            actionUrl: new URL(`${mcpConfig.oauthPathPrefix}/consent`, mcpConfig.baseUrl).href,
        }));
    }

    rememberAuthorizationRequest(authRequestId, payload) {
        this._pendingAuthorizations.set(authRequestId, payload);
    }

    getAuthorizationRequest(authRequestId) {
        return this._pendingAuthorizations.get(authRequestId);
    }

    consumeAuthorizationRequest(authRequestId) {
        const value = this._pendingAuthorizations.get(authRequestId);
        if (value) {
            this._pendingAuthorizations.delete(authRequestId);
        }
        return value;
    }

    async createAuthorizationCode({ client, params, userContext }) {
        const code = generateToken(24);
        const expiresAt = new Date(Date.now() + mcpConfig.authCodeTtlSeconds * 1000);
        await mcpOAuthAuthorizationCodeModel.create({
            codeHash: hashToken(code),
            clientId: client.client_id,
            redirectUri: params.redirectUri,
            codeChallenge: params.codeChallenge,
            scopes: params.scopes?.length ? params.scopes : mcpConfig.scopesSupported,
            resource: params.resource?.href || null,
            state: params.state || null,
            userId: userContext.userId,
            workspaceId: userContext.workspaceId,
            userType: userContext.userType,
            isMaster: userContext.isMaster,
            isOwner: userContext.isOwner,
            machineIds: userContext.machineIds || [],
            access: userContext.access || null,
            expiresAt,
        });
        return code;
    }

    async challengeForAuthorizationCode(_client, authorizationCode) {
        const row = await mcpOAuthAuthorizationCodeModel.findOne({
            codeHash: hashToken(authorizationCode),
            consumedAt: null,
            expiresAt: { $gt: new Date() },
        }).lean();
        if (!row) {
            throw new Error('Invalid authorization code');
        }
        return row.codeChallenge;
    }

    async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri, resource) {
        const row = await mcpOAuthAuthorizationCodeModel.findOne({
            codeHash: hashToken(authorizationCode),
            clientId: client.client_id,
            consumedAt: null,
            expiresAt: { $gt: new Date() },
        }).lean();

        if (!row) {
            throw new Error('Invalid authorization code');
        }
        if (redirectUri && row.redirectUri !== redirectUri) {
            throw new Error('redirect_uri mismatch');
        }
        if (this.validateResource && resource && row.resource && resource.href !== row.resource) {
            throw new Error('Invalid resource');
        }

        await mcpOAuthAuthorizationCodeModel.updateOne(
            { _id: row._id },
            { $set: { consumedAt: new Date() } }
        );

        return tokenService.issueTokenPair({
            clientId: client.client_id,
            scopes: row.scopes || mcpConfig.scopesSupported,
            resource: row.resource,
            userContext: {
                userId: row.userId,
                workspaceId: row.workspaceId,
                userType: row.userType,
                isMaster: row.isMaster,
                isOwner: row.isOwner,
                machineIds: row.machineIds,
                access: row.access,
            },
        });
    }

    async exchangeRefreshToken(client, refreshToken, scopes, resource) {
        return tokenService.exchangeRefreshToken(client, refreshToken, scopes, resource);
    }

    async verifyAccessToken(token) {
        return tokenService.verifyAccessToken(token);
    }

    async revokeToken(client, request) {
        return tokenService.revokeToken(client, request);
    }
}

module.exports = {
    TrackWeavingOAuthProvider,
};
