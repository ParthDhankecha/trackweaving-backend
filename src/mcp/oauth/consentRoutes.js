const express = require('express');
const mcpSdk = require('../sdk');
const rateLimit = mcpSdk.getRateLimit();
const authService = require('../../api/services/authService');
const userService = require('../../api/services/userService');
const utilService = require('../../api/services/utilService');
const mcpConfig = require('../config');
const { renderConsentPage } = require('./consentPage');

function consentPageParams(provider, pending, authRequestId) {
    return {
        authRequestId,
        clientName: pending.client.client_name || pending.client.client_id,
        scopes: pending.params.scopes?.length ? pending.params.scopes : mcpConfig.scopesSupported,
        actionUrl: new URL(`${mcpConfig.oauthPathPrefix}/consent`, mcpConfig.baseUrl).href,
    };
}

function createConsentRouter(provider) {
    const router = express.Router();
    router.use(express.urlencoded({ extended: false }));

    router.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
    }));

    router.post('/consent', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        const { authRequestId, userName, password } = req.body || {};
        const pending = authRequestId ? provider.getAuthorizationRequest(authRequestId) : null;

        const renderError = (message, statusCode = 401) => {
            if (!pending?.client || !pending?.params) {
                return res.status(400).type('html').send(renderConsentPage({
                    authRequestId: authRequestId || '',
                    clientName: 'MCP Client',
                    scopes: mcpConfig.scopesSupported,
                    actionUrl: new URL(`${mcpConfig.oauthPathPrefix}/consent`, mcpConfig.baseUrl).href,
                    errorMessage: 'Authorization session expired. Restart sign-in from your AI client.',
                }));
            }
            return res.status(statusCode).type('html').send(renderConsentPage({
                ...consentPageParams(provider, pending, authRequestId),
                errorMessage: message,
                userNamePrefill: String(userName || '').trim(),
            }));
        };

        try {
            if (!authRequestId || !userName || !password) {
                return renderError('Username and password are required.', 400);
            }

            if (!pending?.client || !pending?.params) {
                return renderError('Authorization session expired. Restart sign-in from your AI client.', 400);
            }

            const userData = await authService.verifyingUser(String(userName).trim(), String(password), true);
            const workspace = await userService.validatePlanForSignIn(userData.workspaceId);
            if (!workspace) {
                throw global.config.message.BAD_REQUEST;
            }

            const sessionPayload = {
                id: userData._id,
                workspaceId: userData.workspaceId,
                type: userData.userType,
            };
            await userService.validateUserSessionAccess(sessionPayload);

            provider.consumeAuthorizationRequest(authRequestId);

            const code = await provider.createAuthorizationCode({
                client: pending.client,
                params: pending.params,
                userContext: {
                    userId: userData._id,
                    workspaceId: userData.workspaceId,
                    userType: userData.userType,
                    isMaster: sessionPayload.isMaster,
                    isOwner: sessionPayload.isOwner,
                    machineIds: sessionPayload.machineIds || [],
                    access: sessionPayload.access || null,
                },
            });

            const redirectUrl = new URL(pending.params.redirectUri);
            redirectUrl.searchParams.set('code', code);
            if (pending.params.state) {
                redirectUrl.searchParams.set('state', pending.params.state);
            }
            return res.redirect(302, redirectUrl.toString());
        } catch (error) {
            utilService.log(error);
            return renderError('Invalid username or password, or your account is not eligible for MCP access.');
        }
    });

    return router;
}

module.exports = {
    createConsentRouter,
};
