/**
 * Auth REST API — ported from the monolith (backend/src/routes/auth.js).
 * Mounted under /auth. Public endpoints (no edge auth) that mint/clear the JWT
 * cookie and own credential + email-verification + password-reset flows.
 */

import crypto from 'node:crypto';
import { Router } from 'express';
import validator from 'validator';
import User from '../models/user.js';
import { validateSignupData, sanitizeSignupData, hashPassword } from '../lib/sanitization.js';
import { enqueueEmail } from '../lib/emailQueue.js';
import { authRateLimiter } from '@dc/ratelimiter';

const router = Router();

const skipEmailVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true';

const sendVerificationEmail = async (user) => {
  const plainToken = crypto.randomBytes(32).toString('hex');
  user.emailVerifyToken = crypto.createHash('sha256').update(plainToken).digest('hex');
  user.emailVerifyExpiry = Date.now() + 24 * 60 * 60 * 1000;
  await user.save();

  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${plainToken}`;

  await enqueueEmail({
    to: user.email,
    subject: 'Verify your email',
    html: `
      <p>Welcome to Developer Connection!</p>
      <p>Please verify your email address by clicking the link below (valid for 24 hours):</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>If you did not create this account, ignore this email.</p>
    `,
  });
};

router.post('/signup', authRateLimiter, async (req, res) => {
  try {
    validateSignupData(req.body);

    const data = sanitizeSignupData(req.body);
    data.email = data.email.toLowerCase();
    data.password = await hashPassword(data.password);

    const user = new User(data);
    if (skipEmailVerification) user.isEmailVerified = true;
    await user.save();
    if (!skipEmailVerification) await sendVerificationEmail(user);

    const message = skipEmailVerification
      ? 'User created successfully.'
      : 'User created successfully. Please check your email to verify your account.';
    res.status(201).json({ message, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email))
      return res.status(400).json({ error: 'Valid email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    if (skipEmailVerification)
      return res.status(400).json({ error: 'Email verification is currently disabled' });

    if (user.isEmailVerified)
      return res.status(400).json({ error: 'This account is already verified' });

    await sendVerificationEmail(user);

    res.status(200).json({ message: 'Verification email resent. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    if (!validator.isEmail(email)) return res.status(400).json({ error: 'Invalid email format' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await user.validatePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    if (!skipEmailVerification && !user.isEmailVerified)
      return res.status(403).json({ error: 'Please verify your email before logging in' });

    const token = user.getJWT();
    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.status(200).json({ message: 'Login successful', user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpiry: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });

    user.isEmailVerified = true;
    user.emailVerifyToken = null;
    user.emailVerifyExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

router.post('/forgot-password', authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email))
      return res.status(400).json({ error: 'Valid email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpiry = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${plainToken}`;

    await enqueueEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password (valid for 15 minutes):</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>If you did not request this, ignore this email.</p>
      `,
    });

    res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password/:token', authRateLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiry: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    user.password = await hashPassword(newPassword);
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    user.tokenVersion += 1;
    await user.save();

    res.status(200).json({ message: 'Password reset successful. Please login.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
