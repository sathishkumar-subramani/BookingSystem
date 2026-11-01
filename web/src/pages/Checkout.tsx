import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { useBookingQuery, useCancelBookingMutation, useConfirmBookingMutation, useMockCheckoutMutation } from '../api/api';
import { errorCode, errorMessage } from '../api/baseQuery';
import { Anim } from '../components/Anim';
import { HallArt } from '../components/HallArt';
import { ErrorBox, Loading, Modal, useToast } from '../components/ui';
import { clock, EVENT_NAMES, inr, longDate } from '../utils/format';

function useSecondsLeft(until: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return until ? Math.max(0, Math.round((Date.parse(until) - now) / 1000)) : 0;
}

function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / total));
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <div className={`timer ${seconds < 120 ? 'urgent' : ''}`} role="timer" aria-live="off">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={seconds < 120 ? 'var(--taken)' : 'var(--held)'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 0.9, ease: 'linear' }}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div>
        <div className="clock">
          {mm}:{ss}
        </div>
        <div className="small">{seconds > 0 ? 'left to pay — the session is held for you' : 'The hold has run out'}</div>
      </div>
    </div>
  );
}

export function Checkout() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useBookingQuery(id);
  const [mockPay, { isLoading: paying }] = useMockCheckoutMutation();
  const [confirm, { isLoading: confirming }] = useConfirmBookingMutation();
  const [cancel, { isLoading: releasing }] = useCancelBookingMutation();
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [method, setMethod] = useState<'upi' | 'card'>('upi');
  const b = data?.booking;
  const seconds = useSecondsLeft(b?.holdExpiresAt ?? null);

  useEffect(() => {
    if (b && b.status === 'CONFIRMED') navigate(`/bookings/${b.id}`, { replace: true });
  }, [b, navigate]);

  if (isLoading) return <div className="container"><Loading /></div>;
  if (error || !b) return <div className="container" style={{ paddingTop: 32 }}><ErrorBox message={errorMessage(error, 'Booking not found.')} /></div>;

  const pay = async (outcome: 'success' | 'failure') => {
    setPayError(null);
    try {
      const paid = await mockPay({ orderId: b.payment!.orderId, outcome }).unwrap();
      const res = await confirm({ id: b.id, ...paid }).unwrap();
      setGatewayOpen(false);
      navigate(`/bookings/${res.booking.id}?new=1`, { replace: true });
    } catch (err) {
      setPayError(errorMessage(err));
      if (errorCode(err) === 'HOLD_EXPIRED' || errorCode(err) === 'SLOT_TAKEN') {
        setGatewayOpen(false);
        toast(errorMessage(err), 'error');
        refetch();
      }
    }
  };

  const release = async () => {
    await cancel({ id: b.id, reason: 'Released before payment' });
    toast('Hold released.');
    navigate(`/halls/${b.venue.slug}`);
  };

  const expired = b.status !== 'HELD' || seconds === 0;

  return (
    <div className="container">
      <div className="checkout-grid">
        <div className="stack">
          <h1>Confirm your booking</h1>
          {b.status === 'HELD' ? (
            <Countdown seconds={seconds} total={600} />
          ) : (
            <p className="notice bad">This hold is {b.status === 'EXPIRED' ? 'expired' : b.status.toLowerCase()}. Pick the date again to start a new booking.</p>
          )}
          <div className="panel">
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <div style={{ width: 120, flex: 'none', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/10' }}>
                <HallArt seed={b.venue.coverStyle} />
              </div>
              <div>
                <h2 style={{ marginBottom: 4 }}>{b.venue.name}</h2>
                <div className="muted small">{[b.venue.area, b.venue.city].filter(Boolean).join(', ')}</div>
              </div>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 18px', margin: '16px 0 0' }}>
                <dt className="muted">Date</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{longDate(b.date)}</dd>
                <dt className="muted">Session</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                  {b.slot.label}, {clock(b.slot.start)} to {clock(b.slot.end)}
                </dd>
                <dt className="muted">Function</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                  {EVENT_NAMES[b.eventKind] ?? b.eventKind} for {b.guests.toLocaleString('en-IN')} guests
                </dd>
                <dt className="muted">Booked by</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                  {b.contact.name}
                  {b.contact.phone && `, ${b.contact.phone}`}
                </dd>
            </dl>
          </div>
          {!expired && (
            <button className="btn ghost" onClick={release} disabled={releasing}>
              Release this hold
            </button>
          )}
          {expired && <Link to={`/halls/${b.venue.slug}?date=${b.date}`} className="btn quiet">Pick the date again</Link>}
        </div>

        <motion.aside className="panel book-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h2>Payment</h2>
          <div className="breakdown">
            <div>
              <span>Hall charge</span>
              <span>{inr(b.pricing.base)}</span>
            </div>
            {b.pricing.adjustmentPercent !== 0 && (
              <div>
                <span>Peak day ({b.pricing.adjustmentPercent > 0 ? '+' : ''}{b.pricing.adjustmentPercent}%)</span>
                <span>{inr(b.pricing.total - b.pricing.base)}</span>
              </div>
            )}
            <div className="total">
              <span>Total</span>
              <span>{inr(b.pricing.total)}</span>
            </div>
            <div>
              <span>Pay now</span>
              <span className="now">{inr(b.pricing.advance)}</span>
            </div>
            <div className="muted">
              <span>Pay at the hall</span>
              <span>{inr(b.pricing.balance)}</span>
            </div>
          </div>
          <motion.button className="btn block big" style={{ marginTop: 18 }} disabled={expired} onClick={() => setGatewayOpen(true)} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}>
            Pay {inr(b.pricing.advance)}
          </motion.button>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Payments are simulated in this demo. Razorpay plugs in here later.
          </p>
        </motion.aside>
      </div>

      <Modal open={gatewayOpen} onClose={() => !paying && !confirming && setGatewayOpen(false)} title="Test payment">
        <div className="stack">
          <div className="gateway">
            <div className="spread">
              <span>Arangam test gateway</span>
              <span className="pill held">Test mode</span>
            </div>
            <div style={{ fontSize: 'var(--t-2xl)', fontWeight: 700, marginTop: 6 }}>{inr(b.pricing.advance)}</div>
            <div className="small muted">Advance for {b.code}</div>
          </div>
          <div className="chips" role="group" aria-label="Payment method">
            <button className="chip" aria-pressed={method === 'upi'} onClick={() => setMethod('upi')}>
              UPI
            </button>
            <button className="chip" aria-pressed={method === 'card'} onClick={() => setMethod('card')}>
              Card
            </button>
          </div>
          <p className="small muted">{method === 'upi' ? 'In the real app your UPI app opens here.' : 'In the real app Razorpay asks for card details here — this app never sees them.'}</p>
          {(paying || confirming) && (
            <div className="row">
              <Anim name="kolam" style={{ width: 44, height: 44 }} />
              <span className="small">{confirming ? 'Confirming with the hall…' : 'Processing payment…'}</span>
            </div>
          )}
          {payError && <ErrorBox message={payError} />}
          <button className="btn block big" onClick={() => pay('success')} disabled={paying || confirming}>
            Pay {inr(b.pricing.advance)}
          </button>
          <button className="btn quiet block" onClick={() => pay('failure')} disabled={paying || confirming}>
            Simulate a declined payment
          </button>
        </div>
      </Modal>
    </div>
  );
}
