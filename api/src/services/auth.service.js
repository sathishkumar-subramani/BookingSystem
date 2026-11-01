import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/ids.js';
import { signAccessToken } from '../middleware/auth.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';

async function issueTokens(user, family = randomToken(12)) {
  const refreshToken = randomToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: sha256(refreshToken),
    family,
    expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
  });
  return { accessToken: signAccessToken(user), refreshToken, user: user.toPublic() };
}

export async function register({ name, email, password, phone, role, businessName, city }) {
  if (role === 'admin') throw forbidden('Admin accounts cannot be self-registered');
  const exists = await User.exists({ email: email.toLowerCase() });
  if (exists) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const user = await User.create({
    name,
    email,
    phone,
    role,
    passwordHash: await bcrypt.hash(password, 10),
    owner: role === 'owner' ? { status: 'pending', businessName: businessName || name, city } : undefined,
  });
  return issueTokens(user);
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // Same message for "no such user" and "wrong password" so emails can't be probed.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Email or password is incorrect');
  }
  if (user.status !== 'active') throw forbidden('This account is suspended. Contact support.');
  user.lastLoginAt = new Date();
  await user.save();
  return issueTokens(user);
}

export async function refresh(refreshToken) {
  if (!refreshToken) throw badRequest('refreshToken is required');
  const hash = sha256(refreshToken);
  // Atomically claim the token so two parallel refreshes can't both succeed.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!claimed) {
    const reused = await RefreshToken.findOne({ tokenHash: hash });
    if (reused?.revokedAt) {
      // A rotated token came back — assume it was stolen and end every session in that family.
      await RefreshToken.updateMany({ family: reused.family, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
    throw unauthorized('Session expired, please sign in again');
  }
  const user = await User.findById(claimed.userId);
  if (!user || user.status !== 'active') throw unauthorized();
  const tokens = await issueTokens(user, claimed.family);
  claimed.replacedBy = sha256(tokens.refreshToken);
  await claimed.save();
  return tokens;
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  await RefreshToken.updateOne({ tokenHash: sha256(refreshToken), revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function updateProfile(user, { name, phone, businessName, city }) {
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone || undefined;
  if (user.role === 'owner' && user.owner) {
    if (businessName !== undefined) user.owner.businessName = businessName;
    if (city !== undefined) user.owner.city = city;
  }
  await user.save();
  return user.toPublic();
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
