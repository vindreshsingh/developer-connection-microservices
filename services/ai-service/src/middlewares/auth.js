import { createUserAuth } from '@dc/auth';
import User from '../models/user.js';

// Loads req.user from the shared users collection (parity with the monolith's
// userAuth) and enforces tokenVersion revocation via the gateway-forwarded
// header.
const userAuth = createUserAuth(User);

export default userAuth;
