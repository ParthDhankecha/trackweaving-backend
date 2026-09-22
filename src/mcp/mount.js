const crypto = require('crypto');
const mcpSdk = require('./sdk');
const mcpConfig = require('./config');
const { TrackWeavingOAuthProvider } = require('./oauth/trackWeavingOAuthProvider');
const { createConsentRouter } = require('./oauth/consentRoutes');
const { createMcpServer } = require('./createMcpServer');
const utilService = require('../api/services/utilService');

let mounted = false;

function mountTrackWeavingMcp(app) {
    if (!mcpConfig.enabled || mounted) {
        return;
    }
    mounted = true;

    const { mcpAuthRouter, mcpAuthMetadataRouter, getOAuthProtectedResourceMetadataUrl, createOAuthMetadata } = mcpSdk.getMcpAuthRouter();
    const { requireBearerAuth } = mcpSdk.getBearerAuth();
    const { StreamableHTTPServerTransport } = mcpSdk.getStreamableHttpTransport();
    const { isInitializeRequest } = mcpSdk.getMcpTypes();

    const validateResource = mcpConfig.strictResource
        ? (resource) => {
            if (!resource) {
                return false;
            }
            const expected = mcpConfig.mcpResourceUrl;
            return resource.href === expected.href || resource.toString() === expected.toString();
        }
        : undefined;

    const provider = new TrackWeavingOAuthProvider({ validateResource });

    app.use(mcpAuthRouter({
        provider,
        issuerUrl: mcpConfig.issuerUrl,
        baseUrl: mcpConfig.issuerUrl,
        resourceServerUrl: mcpConfig.mcpResourceUrl,
        serviceDocumentationUrl: mcpConfig.serviceDocumentationUrl,
        scopesSupported: mcpConfig.scopesSupported,
        resourceName: mcpConfig.resourceName,
    }));

    app.use(mcpConfig.oauthPathPrefix, createConsentRouter(provider));

    const oauthMetadata = createOAuthMetadata({
        provider,
        issuerUrl: mcpConfig.issuerUrl,
        baseUrl: mcpConfig.issuerUrl,
        scopesSupported: mcpConfig.scopesSupported,
    });

    app.use(mcpAuthMetadataRouter({
        oauthMetadata,
        resourceServerUrl: mcpConfig.mcpResourceUrl,
        scopesSupported: mcpConfig.scopesSupported,
        resourceName: mcpConfig.resourceName,
        serviceDocumentationUrl: mcpConfig.serviceDocumentationUrl,
    }));

    const tokenVerifier = {
        verifyAccessToken: (token) => provider.verifyAccessToken(token),
    };

    const authMiddleware = requireBearerAuth({
        verifier: tokenVerifier,
        requiredScopes: [],
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpConfig.mcpResourceUrl),
    });

    const transports = {};

    const mcpPostHandler = async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        try {
            let transport;
            if (sessionId && transports[sessionId]) {
                transport = transports[sessionId];
            } else if (!sessionId && isInitializeRequest(req.body)) {
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => crypto.randomUUID(),
                    onsessioninitialized: (sid) => {
                        transports[sid] = transport;
                    },
                });
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && transports[sid]) {
                        delete transports[sid];
                    }
                };
                const server = createMcpServer(req.auth);
                await server.connect(transport);
                await transport.handleRequest(req, res, req.body);
                if (transport.sessionId) {
                    transports[transport.sessionId] = transport;
                }
                return;
            } else {
                res.status(400).json({
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                    id: null,
                });
                return;
            }
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            utilService.log(error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null,
                });
            }
        }
    };

    const mcpGetHandler = async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        const transport = sessionId ? transports[sessionId] : null;
        if (!transport) {
            res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'Session not found' },
                id: null,
            });
            return;
        }
        await transport.handleRequest(req, res);
    };

    const mcpDeleteHandler = async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }
        await transports[sessionId].handleRequest(req, res);
    };

    const mcpPath = mcpConfig.mcpResourceUrl.pathname.replace(/\/$/, '') || '/mcp';
    app.post(mcpPath, authMiddleware, mcpPostHandler);
    app.get(mcpPath, authMiddleware, mcpGetHandler);
    app.delete(mcpPath, authMiddleware, mcpDeleteHandler);

    app.get('/docs/mcp', (_req, res) => {
        res.type('html').send(`<!DOCTYPE html><html><body style="font-family:system-ui;max-width:720px;margin:40px auto;line-height:1.5">
<h1>TrackWeaving MCP</h1>
<p>Streamable HTTP endpoint: <code>${mcpConfig.mcpResourceUrl.href}</code></p>
<p>OAuth issuer: <code>${mcpConfig.issuerUrl.href}</code></p>
<p>Scopes: <code>${mcpConfig.scopesSupported.join(' ')}</code></p>
<p>See <code>trackweaving-backend/docs/MCP.md</code> for Cursor / ChatGPT setup.</p>
</body></html>`);
    });

    utilService.infoLog?.(`TrackWeaving MCP mounted at ${mcpPath} (OAuth ${mcpConfig.issuerUrl.href})`);
}

module.exports = {
    mountTrackWeavingMcp,
};
