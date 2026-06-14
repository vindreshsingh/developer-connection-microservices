import { Router } from 'express';
import mongoose from 'mongoose';
import { requireServiceToken } from '@dc/auth';
import { decryptToken } from '../lib/encryption.js';
import { hashPassword } from '../lib/sanitization.js';
import Account from '../models/account.js';

const router = Router();

router.use(requireServiceToken);

router.get('/accounts/:userId/session', async (req, res) => {
  const account = await Account.findById(req.params.userId).select('tokenVersion isActive');
  if (!account || !account.isActive) return res.status(404).json({ valid: false });

  const fwd = req.query.tokenVersion;
  if (fwd !== undefined && Number(fwd) !== account.tokenVersion) {
    return res.json({ valid: false });
  }
  res.json({ valid: true, tokenVersion: account.tokenVersion });
});

router.get('/accounts/:userId/linked-accounts', async (req, res) => {
  const account = await Account.findById(req.params.userId).select('oauthProviders');
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const linked = (account.oauthProviders || []).map((p) => ({ provider: p.provider, linkedAt: p.linkedAt }));
  res.json({ linkedAccounts: linked });
});

router.get('/accounts/:userId/oauth/:provider/token', async (req, res) => {
  const { userId, provider } = req.params;
  const account = await Account.findById(userId).select('oauthProviders');
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const entry = account.oauthProviders?.find((p) => p.provider === provider);
  if (!entry?.accessToken) return res.status(404).json({ error: 'Provider not linked' });

  res.json({ accessToken: decryptToken(entry.accessToken) });
});

router.delete('/accounts/:userId/oauth/:provider', async (req, res) => {
  const { userId, provider } = req.params;
  const account = await Account.findById(userId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  if (!account.oauthProviders?.some((p) => p.provider === provider)) {
    return res.status(400).json({ error: `${provider} account is not linked.` });
  }

  const otherProviders = account.oauthProviders.filter((p) => p.provider !== provider);
  const hasPassword = Boolean(account.password);
  if (!hasPassword && otherProviders.length === 0) {
    return res.status(400).json({
      error: 'Cannot disconnect your only login method. Set a password first.',
    });
  }

  account.oauthProviders = otherProviders;
  await account.save();
  res.json({ ok: true });
});

router.patch('/accounts/:userId/password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const account = await Account.findById(req.params.userId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  account.password = await hashPassword(newPassword);
  account.tokenVersion += 1;
  await account.save();
  res.json({ ok: true, tokenVersion: account.tokenVersion });
});

router.post('/accounts/:userId/deactivate', async (req, res) => {
  const account = await Account.findById(req.params.userId);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  account.isActive = false;
  account.deletedAt = new Date();
  await account.save();
  res.json({ ok: true });
});

router.get('/accounts/:userId/has-password', async (req, res) => {
  const account = await Account.findById(req.params.userId).select('password');
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json({ hasPassword: Boolean(account.password) });
});

export default router;
