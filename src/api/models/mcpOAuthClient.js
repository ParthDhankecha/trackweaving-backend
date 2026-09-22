const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mcpOAuthClientSchema = new Schema({
    clientId: { type: String, required: true, unique: true, index: true },
    clientSecretHash: { type: String, default: null },
    clientSecretExpiresAt: { type: Date, default: null },
    clientName: { type: String, trim: true, default: 'MCP Client' },
    redirectUris: { type: [String], default: [] },
    grantTypes: { type: [String], default: ['authorization_code', 'refresh_token'] },
    responseTypes: { type: [String], default: ['code'] },
    tokenEndpointAuthMethod: { type: String, default: 'none' },
    scope: { type: String, default: 'mcp:read' },
    clientIdIssuedAt: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
}, {
    versionKey: false,
    timestamps: true,
});

mcpOAuthClientSchema.index({ isDeleted: 1, clientId: 1 });

module.exports = mongoose.model('mcpOAuthClient', mcpOAuthClientSchema, 'mcpOAuthClients');
