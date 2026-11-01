import crypto from 'node:crypto';

// No 0/O/1/I/L so a code read out over the phone isn't misheard.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const randomCode = (length = 6) => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

export const bookingCode = () => `ARG-${randomCode(6)}`;

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');
