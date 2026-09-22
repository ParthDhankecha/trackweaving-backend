const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mcpOAuthAuthorizationCodeSchema = new Schema({
    codeHash: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    scopes: { type: [String], default: ['mcp:read'] },
    resource: { type: String, default: null },
    state: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'workspace', required: true },
    userType: { type: Number, required: true },
    isMaster: { type: Boolean, default: false },
    isOwner: { type: Boolean, default: false },
    machineIds: { type: [Schema.Types.ObjectId], default: [] },
    access: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
}, {
    versionKey: false,
    timestamps: true,
});

mcpOAuthAuthorizationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
    'mcpOAuthAuthorizationCode',
    mcpOAuthAuthorizationCodeSchema,
    'mcpOAuthAuthorizationCodes'
);
