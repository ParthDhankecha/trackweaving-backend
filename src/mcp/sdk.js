function resolveMcpDep(subpath) {
    try {
        return require(subpath);
    } catch (error) {
        throw new Error(
            `MCP dependency "${subpath}" not found. Run "npm install" in trackweaving-backend. Original: ${error.message}`
        );
    }
}

module.exports = {
    getMcpServer() {
        return resolveMcpDep('@modelcontextprotocol/sdk/server/mcp.js');
    },
    getStreamableHttpTransport() {
        return resolveMcpDep('@modelcontextprotocol/sdk/server/streamableHttp.js');
    },
    getMcpAuthRouter() {
        return resolveMcpDep('@modelcontextprotocol/sdk/server/auth/router.js');
    },
    getBearerAuth() {
        return resolveMcpDep('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
    },
    getMcpTypes() {
        return resolveMcpDep('@modelcontextprotocol/sdk/types.js');
    },
    getZod() {
        return resolveMcpDep('zod/v4');
    },
    getRateLimit() {
        return resolveMcpDep('express-rate-limit');
    },
    getMetadataHandler() {
        return resolveMcpDep('@modelcontextprotocol/sdk/server/auth/handlers/metadata.js').metadataHandler;
    },
};
