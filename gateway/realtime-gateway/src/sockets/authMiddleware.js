import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { config } from '@dc/config';
import User from '../models/user.js';

// Ported from the monolith (backend/src/sockets/authMiddleware.js). The
// realtime-gateway verifies the same httpOnly `token` cookie itself — the
// api-gateway forwards the WS upgrade (cookies intact) but its HTTP edge-auth
// middleware does not run on raw socket upgrades, so there is no trusted
// internal header on the handshake. Same auth system as REST, no second one.
const socketAuthMiddleware = async (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers?.cookie;
    if (!rawCookie) return next(new Error('Authentication required'));

    const { token } = cookie.parse(rawCookie);
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('User not found'));

    if (decoded.tokenVersion !== user.tokenVersion) {
      return next(new Error('Session expired. Please login again'));
    }

    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
};

export default socketAuthMiddleware;
