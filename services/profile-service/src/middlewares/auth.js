import { createUserAuth } from '@dc/auth';
import User from '../models/user.js';

// Loads the full user document onto req.user (parity with the monolith's
// userAuth) and re-checks tokenVersion via the gateway-forwarded header.
const userAuth = createUserAuth(User);

export default userAuth;
