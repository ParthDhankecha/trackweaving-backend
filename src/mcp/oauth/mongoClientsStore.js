const mcpConfig = require('../config');
const { generateClientId, generateClientSecret, hashToken } = require('./crypto');

class MongoOAuthClientsStore {
    async getClient(clientId) {
        const row = await mcpOAuthClientModel.findOne({ clientId, isDeleted: false }).lean();
        if (!row) {
            return undefined;
        }
        return {
            client_id: row.clientId,
            client_secret: row.clientSecretHash ? undefined : undefined,
            client_id_issued_at: row.clientIdIssuedAt,
            client_name: row.clientName,
            redirect_uris: row.redirectUris || [],
            grant_types: row.grantTypes || ['authorization_code', 'refresh_token'],
            response_types: row.responseTypes || ['code'],
            token_endpoint_auth_method: row.tokenEndpointAuthMethod || 'none',
            scope: row.scope || mcpConfig.scopesSupported.join(' '),
            client_secret_expires_at: row.clientSecretExpiresAt
                ? Math.floor(new Date(row.clientSecretExpiresAt).getTime() / 1000)
                : 0,
        };
    }

    async registerClient(clientMetadata) {
        const clientId = clientMetadata.client_id || generateClientId();
        const useSecret = clientMetadata.token_endpoint_auth_method === 'client_secret_post';
        const plainSecret = useSecret ? generateClientSecret() : null;

        const doc = await mcpOAuthClientModel.create({
            clientId,
            clientSecretHash: plainSecret ? hashToken(plainSecret) : null,
            clientSecretExpiresAt: null,
            clientName: clientMetadata.client_name || 'MCP Client',
            redirectUris: clientMetadata.redirect_uris || [],
            grantTypes: clientMetadata.grant_types || ['authorization_code', 'refresh_token'],
            responseTypes: clientMetadata.response_types || ['code'],
            tokenEndpointAuthMethod: clientMetadata.token_endpoint_auth_method || 'none',
            scope: clientMetadata.scope || mcpConfig.scopesSupported.join(' '),
            clientIdIssuedAt: Math.floor(Date.now() / 1000),
        });

        const registered = {
            client_id: doc.clientId,
            client_id_issued_at: doc.clientIdIssuedAt,
            client_name: doc.clientName,
            redirect_uris: doc.redirectUris,
            grant_types: doc.grantTypes,
            response_types: doc.responseTypes,
            token_endpoint_auth_method: doc.tokenEndpointAuthMethod,
            scope: doc.scope,
            client_secret_expires_at: 0,
        };
        if (plainSecret) {
            registered.client_secret = plainSecret;
        }
        return registered;
    }

    async verifyClientSecret(clientId, clientSecret) {
        const row = await mcpOAuthClientModel.findOne({ clientId, isDeleted: false }).lean();
        if (!row?.clientSecretHash) {
            return false;
        }
        return hashToken(clientSecret) === row.clientSecretHash;
    }
}

module.exports = {
    MongoOAuthClientsStore,
};
