const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mcpOAuthTokenSchema = new Schema({
    tokenHash: { type: String, required: true, unique: true, index: true },
    tokenType: { type: String, enum: ['access', 'refresh'], required: true },
    clientId: { type: String, required: true, index: true },
    scopes: { type: [String], default: ['mcp:read'] },
    resource: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'workspace', required: true },
    userType: { type: Number, required: true },
    isMaster: { type: Boolean, default: false },
    isOwner: { type: Boolean, default: false },
    machineIds: { type: [Schema.Types.ObjectId], default: [] },
    access: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    refreshTokenHash: { type: String, default: null, index: true },
}, {
    versionKey: false,
    timestamps: true,
});

mcpOAuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('mcpOAuthToken', mcpOAuthTokenSchema, 'mcpOAuthTokens');
