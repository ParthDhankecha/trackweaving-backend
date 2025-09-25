const jwtService = require('../services/jwtService');
const { log } = require('../services/utilService');


module.exports = async (req, res, next) => {
  try {
    if (req.headers && req.headers.authorization) {
  
      const payload = await jwtService.verifyToken(req.headers.authorization);
  
      if (payload.id) {
  
        req.user = payload;
      } else if (payload.expiredAt) {
  
        return res.unauthorized({}, global.config.message.TOKEN_EXPIRED);
      } else {
  
        return res.unauthorized({}, global.config.message.UNAUTHORIZED);
      }
  
      next();
    } else {
      return res.unauthorized({}, global.config.message.UNAUTHORIZED);
    }
  } catch (error) {
    log(error);
    return res.unauthorized({}, global.config.message.TOKEN_EXPIRED);
  }
  
};