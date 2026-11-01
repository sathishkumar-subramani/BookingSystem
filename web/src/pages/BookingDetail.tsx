import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useBookingQuery, useCancelBookingMutation } from '../api/api';
import { errorMessage } from '../api/baseQuery';
import { Anim } from '../components/Anim';
import { SilkBorder } from '../components/SilkBorder';
import { ErrorBox, Loading, Modal, StatusPill, useToast } from '../components/ui';
import { useCurrentUser } from '../store';
import { clock, EVENT_NAMES, inr, longDate, POLICY_NAMES } from '../utils/format';

export function BookingDetail() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const user = useCurrentUser();
  const toast = useToast();
  const { data, isLoading, error } = useBookingQuery(id);
  const [cancel, { isLoading: cancelling, error: cancelError }] = useCancelBookingMutation();
  const [askCancel, setAskCancel] = useState(false);
  const [reason, setReason] = useState('');
  const fresh = sp.get('new') === '1';
  const [celebrating, setCelebrating] = useState(fresh);
  const b = data?.booking;

  if (isLoading) return <div className="container"><Loading /></div>;
  if (error || !b) return <div className="container" style={{ paddingTop: 32 }}><ErrorBox message={errorMessage(error, 'Booking not found.')} /></div>;

  const as = user?.role === 'owner' && b.customer ? 'owner' : user?.role === 'admin' ? 'admin' : undefined;
  const quote = b.cancelQuote;

  const doCancel = async () => {
    try {
      await cancel({ id: b.id, reason: reason || undefined, as }).unwrap();
      setAskCancel(false);
      toast(quote && quote.refundAmount > 0 ? `Cancelled. ${inr(quote.refundAmount)} will be refunded.` : 'Cancelled.');
    } catch {
      /* shown in the modal */
    }
  };

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <AnimatePresence>
        {celebrating && (
          <motion.div
            className="celebrate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 60, background: 'color-mix(in srgb, var(--bg) 60%, transparent)', backdropFilter: 'blur(3px)' }}
          >
            <Anim
              name="celebrate"
              loop={false}
              stillFrame={60}
              style={{ width: 'min(420px, 90vw)', height: 'min(420px, 90vw)' }}
              onComplete={() => {
                setCelebrating(false);
                setSp({}, { replace: true });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: fresh ? 0.6 : 0, duration: 0.5 }} style={{ marginTop: 28 }}>
        {fresh && b.status === 'CONFIRMED' && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h1>The hall is yours</h1>
            <p className="muted">Show this code to the hall manager. The balance is paid at the hall.</p>
          </div>
        )}
        <article className="ticket">
          <SilkBorder />
          <div className="inner">
            <div className="spread">
              <div>
                <div className="small muted">Booking code</div>
                <div className="code">{b.code}</div>
              </div>
              <StatusPill status={b.status} />
            </div>
            <h2 style={{ marginTop: 18, marginBottom: 2 }}>
              <Link to={`/halls/${b.venue.slug}`}>{b.venue.name}</Link>
            </h2>
            <div className="muted">{[b.venue.area, b.venue.city, b.venue.district].filter(Boolean).join(', ')}</div>
            <dl>
              <dt>Date</dt>
              <dd>{longDate(b.date)}</dd>
              <dt>Session</dt>
              <dd>
                {b.slot.label}, {clock(b.slot.start)} to {clock(b.slot.end)}
              </dd>
              <dt>Function</dt>
              <dd>
                {EVENT_NAMES[b.eventKind] ?? b.eventKind}, {b.guests.toLocaleString('en-IN')} guests
              </dd>
              <dt>Contact</dt>
              <dd>
                {b.contact.name}
                {b.contact.phone && `, ${b.contact.phone}`}
              </dd>
              {b.customer && (
                <>
                  <dt>Customer account</dt>
                  <dd>
                    {b.customer.name} ({b.customer.email})
                  </dd>
                </>
              )}
              {b.venueContactPhone && (
                <>
                  <dt>Hall phone</dt>
                  <dd>
                    <a href={`tel:${b.venueContactPhone}`}>{b.venueContactPhone}</a>
                  </dd>
                </>
              )}
              <dt>Total</dt>
              <dd>{inr(b.pricing.total)}</dd>
              <dt>Advance paid</dt>
              <dd>{b.status === 'HELD' ? 'Not yet' : inr(b.pricing.advance)}</dd>
              <dt>Balance</dt>
              <dd>
                {inr(b.pricing.balance)} <span className={`pill ${b.balanceStatus === 'DUE' ? 'DUE' : 'free'}`}>{b.balanceStatus === 'DUE' ? 'due at the hall' : 'paid'}</span>
              </dd>
              <dt>Cancellation</dt>
              <dd>{POLICY_NAMES[b.cancellationPolicy]} policy</dd>
              {b.cancellation && (
                <>
                  <dt>Cancelled</dt>
                  <dd>
                    by {b.cancellation.by}
                    {b.cancellation.reason && ` (${b.cancellation.reason})`}, refund {inr(b.cancellation.refundAmount)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </article>

        <div className="row" style={{ marginTop: 18 }}>
          {b.status === 'HELD' && user?.role !== 'owner' && (
            <Link to={`/checkout/${b.id}`} className="btn">
              Finish payment
            </Link>
          )}
          {quote?.cancellable && b.status === 'CONFIRMED' && (
            <button className="btn danger" onClick={() => setAskCancel(true)}>
              Cancel booking
            </button>
          )}
          <Link to={user?.role === 'owner' ? '/owner/bookings' : user?.role === 'admin' ? '/admin/bookings' : '/bookings'} className="btn quiet">
            All bookings
          </Link>
        </div>
      </motion.div>

      <Modal open={askCancel} onClose={() => setAskCancel(false)} title="Cancel this booking?">
        <div className="stack">
          {quote && (
            <p>
              {as ? (
                <>The customer gets the full advance of <b>{inr(quote.refundAmount)}</b> back.</>
              ) : quote.refundAmount > 0 ? (
                <>
                  You'll get <b>{inr(quote.refundAmount)}</b> back ({quote.refundPercent}% of the advance) — the event is {quote.daysBefore} days away.
                </>
              ) : (
                <>The event is {quote.daysBefore} days away, so under this hall's policy the advance is not refunded.</>
              )}
            </p>
          )}
          <label className="field">
            <span>Reason (optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </label>
          {cancelError && <ErrorBox message={errorMessage(cancelError)} />}
          <div className="row">
            <button className="btn danger" onClick={doCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel booking'}
            </button>
            <button className="btn quiet" onClick={() => setAskCancel(false)}>
              Keep it
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
