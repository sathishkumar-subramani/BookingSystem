import crypto from 'node:crypto';
import { randomCode } from '../../lib/ids.js';

// A stand-in payment gateway that behaves like Razorpay:
//   createOrder → the app opens a checkout → checkout returns paymentId + signature → server verifies.
// The signature uses Razorpay's exact formula: HMAC-SHA256(secret, `${orderId}|${paymentId}`),
// so the verify step in booking code is already the real one.
export function createMockProvider({ secret }) {
  const sign = (orderId, paymentId) =>
    crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  return {
    name: 'mock',
    testMode: true,

    async createOrder({ amount, currency = 'INR', receipt }) {
      return { orderId: `order_MOCK${randomCode(12)}`, amount, currency, receipt };
    },

    /** What the client needs to open its checkout. */
    checkoutOptions({ orderId, amount, currency = 'INR' }) {
      return { provider: 'mock', orderId, amount, currency, keyId: null };
    },

    verifyPayment({ orderId, paymentId, signature }) {
      if (!orderId || !paymentId || !signature) return false;
      const expected = Buffer.from(sign(orderId, paymentId));
      const given = Buffer.from(String(signature));
      return expected.length === given.length && crypto.timingSafeEqual(expected, given);
    },

    async refund({ paymentId, amount }) {
      return { refundId: `rfnd_MOCK${randomCode(12)}`, paymentId, amount, status: 'processed' };
    },

    /** Mock-only: plays the part of the gateway's checkout page. */
    simulateCheckout({ orderId }) {
      const paymentId = `pay_MOCK${randomCode(12)}`;
      return { orderId, paymentId, signature: sign(orderId, paymentId) };
    },
  };
}
