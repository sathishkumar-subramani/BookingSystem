import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as auth from '../services/auth.service.js';
import { loginBody, logoutBody, passwordBody, profileBody, refreshBody, registerBody } from './schemas.js';

const router = Router();

// Slow down password guessing: 30 attempts per 15 minutes per IP.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 10_000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } },
});

// Token refresh happens in the background for every signed-in phone; many share one IP on mobile networks.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 10_000 : 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a few minutes.' } },
});

router.post('/register', limiter, validate({ body: registerBody }), async (req, res) => {
  res.status(201).json(await auth.register(req.data.body));
});

router.post('/login', limiter, validate({ body: loginBody }), async (req, res) => {
  res.json(await auth.login(req.data.body));
});

router.post('/refresh', refreshLimiter, validate({ body: refreshBody }), async (req, res) => {
  res.json(await auth.refresh(req.data.body.refreshToken));
});

router.post('/logout', validate({ body: logoutBody }), async (req, res) => {
  await auth.logout(req.data.body.refreshToken);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user.toPublic() });
});

router.patch('/me', requireAuth, validate({ body: profileBody }), async (req, res) => {
  res.json({ user: await auth.updateProfile(req.user, req.data.body) });
});

router.post('/me/password', requireAuth, validate({ body: passwordBody }), async (req, res) => {
  await auth.changePassword(req.user._id, req.data.body);
  res.status(204).end();
});

export default router;
