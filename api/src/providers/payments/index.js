import { config } from '../../config.js';
import { createMockProvider } from './mock.js';
import { createRazorpayProvider } from './razorpay.js';

// Port: every payment gateway exposes the same small interface —
//   createOrder · checkoutOptions · verifyPayment · refund   (+ simulateCheckout for the mock)
// Booking code only ever talks to this interface, never to a gateway SDK directly.
let provider;

export function paymentProvider() {
  if (!provider) {
    provider =
      config.paymentProvider === 'razorpay'
        ? createRazorpayProvider({
            keyId: process.env.RAZORPAY_KEY_ID,
            keySecret: process.env.RAZORPAY_KEY_SECRET,
          })
        : createMockProvider({ secret: config.mockPaymentSecret });
  }
  return provider;
}
