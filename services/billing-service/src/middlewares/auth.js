import { createUserAuth } from '@dc/auth';
import User from '../models/user.js';

const userAuth = createUserAuth(User);

export default userAuth;
