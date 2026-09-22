const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { env, port } = require('../config/env-vars');

function getPublicBaseUrl() {
    if (process.env.MCP_PUBLIC_BASE_URL) {
        return new URL(process.env.MCP_PUBLIC_BASE_URL);
    }
    const host = process.env.MCP_PUBLIC_HOST || 'localhost';
    const mcpPort = process.env.MCP_PUBLIC_PORT || port || '3000';
    return new URL(`http://${host}:${mcpPort}`);
}

const baseUrl = getPublicBaseUrl();
const mcpPath = process.env.MCP_HTTP_PATH || '/mcp';
const oauthPathPrefix = process.env.MCP_OAUTH_PATH_PREFIX || '/oauth';

function resolveIssuerOrigin() {
    if (process.env.MCP_OAUTH_ISSUER_URL) {
        return new URL(process.env.MCP_OAUTH_ISSUER_URL).origin;
    }
    return baseUrl.origin;
}

const issuerOrigin = resolveIssuerOrigin();

module.exports = {
    enabled: process.env.MCP_ENABLED !== 'false',
    env,
    baseUrl,
    issuerOrigin,
    mcpResourceUrl: new URL(mcpPath, baseUrl),
    issuerUrl: new URL(issuerOrigin),
    oauthPathPrefix,
    scopesSupported: ['mcp:read'],
    resourceName: 'TrackWeaving API',
    serviceDocumentationUrl: process.env.MCP_DOCS_URL
        ? new URL(process.env.MCP_DOCS_URL)
        : new URL('/docs/mcp', baseUrl),
    accessTokenTtlSeconds: parseInt(process.env.MCP_ACCESS_TOKEN_TTL_SECONDS || '3600', 10),
    refreshTokenTtlSeconds: parseInt(process.env.MCP_REFRESH_TOKEN_TTL_SECONDS || '2592000', 10),
    authCodeTtlSeconds: parseInt(process.env.MCP_AUTH_CODE_TTL_SECONDS || '600', 10),
    cookieName: process.env.MCP_CONSENT_COOKIE_NAME || 'tw_mcp_consent',
    strictResource: process.env.MCP_STRICT_RESOURCE !== 'false',
};
