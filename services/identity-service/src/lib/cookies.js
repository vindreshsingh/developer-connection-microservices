// Shared JWT cookie options — login and OAuth callback must match so production
// cookie behavior is consistent across auth methods.
export const tokenCookieOptions = {
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};
