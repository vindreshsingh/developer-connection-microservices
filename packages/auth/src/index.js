import jwt from 'jsonwebtoken';
import { config } from '@dc/config';

// Verify a JWT (used by the gateway at the edge).
export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

// Downstream services trust the gateway's signed internal header instead of
// re-validating the cookie. The gateway sets it after verifyToken() succeeds.
export const requireUser = (req, _res, next) => {
  const userId = req.headers[config.internalAuthHeader];
  if (!userId) {
    const e = new Error('Missing internal user header');
    e.statusCode = 401;
    return next(e);
  }
  req.userId = userId;
  next();
};
