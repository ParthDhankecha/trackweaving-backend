const path = require('path');

const MCP_NODE_MODULES = path.join(__dirname, '..', '..', '..', 'trackweaving-mcp', 'node_modules');

function resolveFromMcpPackage(subpath) {
    try {
        return require(require.resolve(subpath, { paths: [MCP_NODE_MODULES, __dirname] }));
    } catch (primaryError) {
        try {
            return require(subpath);
        } catch (_secondaryError) {
            throw new Error(
                `MCP dependency "${subpath}" not found. Run "npm install" inside trackweaving-mcp/ first. Original: ${primaryError.message}`
            );
        }
    }
}

module.exports = {
    getMcpServer() {
        return resolveFromMcpPackage('@modelcontextprotocol/sdk/server/mcp.js');
    },
    getStreamableHttpTransport() {
        return resolveFromMcpPackage('@modelcontextprotocol/sdk/server/streamableHttp.js');
    },
    getMcpAuthRouter() {
        return resolveFromMcpPackage('@modelcontextprotocol/sdk/server/auth/router.js');
    },
    getBearerAuth() {
        return resolveFromMcpPackage('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
    },
    getMcpTypes() {
        return resolveFromMcpPackage('@modelcontextprotocol/sdk/types.js');
    },
    getZod() {
        return resolveFromMcpPackage('zod/v4');
    },
    getRateLimit() {
        return resolveFromMcpPackage('express-rate-limit');
    },
    getMetadataHandler() {
        return resolveFromMcpPackage('@modelcontextprotocol/sdk/server/auth/handlers/metadata.js').metadataHandler;
    },
};
