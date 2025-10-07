const jwt = require('jsonwebtoken');

const JWT_EXPIRES_IN_SECONDS = 3600 * 24; /** 3600 seconds = 1 hour, 3600 * 24 = 24 hours */
const JWT_SECRET_KEY = "EtH6U0TSiPpRop!r97QneDMlKSRtY@EWjdAdsRdmSen$AVQrVjnRD98bVa3mjTal#i289Kj0ejbGU7QER";
const ALGORITHM = "HS256";


module.exports = {
    /**
     * Creates a JWT token for the user.
     * @param {Object} user - The user object containing user details.
     * @param {number} [expiresIn=JWT_EXPIRES_IN_SECONDS] - The expiration time in seconds for the token.
     * @return {Object} - An object containing the access token and its expiration time.
     */
    createToken(user, expiresIn = JWT_EXPIRES_IN_SECONDS) {

        const payload = {
            user: {
                id: user._id,
                type: user?.userType,
                workspaceId: user?.workspaceId || null,
                subUserLimit: user?.plan?.subUserLimit || 4
            }
        };

        const accessToken = jwt.sign(payload, JWT_SECRET_KEY, {
            algorithm: ALGORITHM,
            expiresIn: expiresIn,
        });

        return { expiresIn, accessToken };
    },

    /**
     * Verifies the JWT token and returns the user information.
     * @param {string} token - The JWT token to verify.
     * @return {Object} - The user information extracted from the token.
     * @throws {Error} - Throws an error if the token is invalid or expired.
     */
    verifyToken(token) {
        const payload = jwt.verify(token, JWT_SECRET_KEY, {
            algorithms: [ALGORITHM]
        });

        return payload.user;
    },

    /**
     * Checks if the error is a JWT token expired error.
     * @param {Error} error - The error to check.
     * @return {boolean} - Returns true if the error is a JWT token expired error, otherwise false.
     */
    isJwtTokenExpiredError(error) {
        return error instanceof jwt.TokenExpiredError;
    }
};