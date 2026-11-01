import crypto from 'node:crypto';
import { AppError } from '../../lib/errors.js';

// Razorpay adapter — ready for when you add keys (PAYMENT_PROVIDER=razorpay, RAZORPAY_KEY_ID,
// RAZORPAY_KEY_SECRET). Not exercised by the tests yet: try it with Razorpay *test* keys first.
// Docs: https://razorpay.com/docs/payments/server-integration/nodejs/
export function createRazorpayProvider({ keyId, keySecret }) {
  if (!keyId || !keySecret) {
    throw new Error('PAYMENT_PROVIDER=razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  }
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

  async function call(path, body) {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', data?.error?.description || 'Payment gateway error');
    }
    return data;
  }

  return {
    name: 'razorpay',
    testMode: keyId.startsWith('rzp_test_'),

    async createOrder({ amount, currency = 'INR', receipt, notes }) {
      const order = await call('/orders', { amount, currency, receipt, notes });
      return { orderId: order.id, amount: order.amount, currency: order.currency, receipt };
    },

    checkoutOptions({ orderId, amount, currency = 'INR' }) {
      return { provider: 'razorpay', orderId, amount, currency, keyId };
    },

    verifyPayment({ orderId, paymentId, signature }) {
      if (!orderId || !paymentId || !signature) return false;
      const expected = Buffer.from(
        crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex'),
      );
      const given = Buffer.from(String(signature));
      return expected.length === given.length && crypto.timingSafeEqual(expected, given);
    },

    async refund({ paymentId, amount }) {
      const refund = await call(`/payments/${paymentId}/refund`, { amount });
      return { refundId: refund.id, paymentId, amount: refund.amount, status: refund.status };
    },

    simulateCheckout() {
      throw new AppError(404, 'NOT_FOUND', 'Simulated checkout is only available with the mock provider');
    },
  };
}
