import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { config } from '@dc/config';
import { validateSession, getProfile } from '@dc/service-clients';

const socketAuthMiddleware = async (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers?.cookie;
    if (!rawCookie) return next(new Error('Authentication required'));

    const { token } = cookie.parse(rawCookie);
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = decoded.id ?? decoded._id ?? decoded.sub;
    if (!userId) return next(new Error('Authentication required'));

    const valid = await validateSession(
      userId,
      decoded.tokenVersion !== undefined ? Number(decoded.tokenVersion) : undefined,
    );
    if (!valid) return next(new Error('Session expired. Please login again'));

    const profile = await getProfile(userId);
    if (!profile) return next(new Error('User not found'));

    socket.user = { ...profile, _id: profile._id || userId };
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
};

export default socketAuthMiddleware;
