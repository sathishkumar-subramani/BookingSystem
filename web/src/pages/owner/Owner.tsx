import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  useAddBlockMutation,
  useMarkBalancePaidMutation,
  useOwnerBookingsQuery,
  useOwnerCalendarQuery,
  useOwnerSummaryQuery,
  useOwnerVenuesQuery,
  useRemoveBlockMutation,
  useSetSpecialPriceMutation,
  useSubmitVenueMutation,
} from '../../api/api';
import { errorMessage } from '../../api/baseQuery';
import type { AvailabilityDay, SlotKey, UnitKey } from '../../api/types';
import { AvailabilityCalendar } from '../../components/AvailabilityCalendar';
import { HallArt } from '../../components/HallArt';
import { CountUp, Empty, ErrorBox, Loading, Modal, StatusPill, stagger, useToast } from '../../components/ui';
import { useCurrentUser } from '../../store';
import { EVENT_NAMES, inr, inrShort, longDate, monthTitle, shortDate, SLOT_NAMES, todayISO } from '../../utils/format';

export function OwnerLayout() {
  const { data } = useOwnerSummaryQuery();
  return (
    <div className="container">
      <div className="console">
        <nav className="side-nav" aria-label="Owner">
          <NavLink to="/owner" end>
            Overview
          </NavLink>
          <NavLink to="/owner/halls">My halls</NavLink>
          <NavLink to="/owner/calendar">Calendar</NavLink>
          <NavLink to="/owner/bookings">
            Bookings {data && data.upcomingCount > 0 && <span className="count">{data.upcomingCount}</span>}
          </NavLink>
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function OwnerStatusNotice() {
  const user = useCurrentUser();
  const s = user?.owner?.status;
  if (s === 'approved') return null;
  return (
    <p className={`notice ${s === 'rejected' ? 'bad' : ''}`}>
      {s === 'rejected'
        ? `Your owner account was not approved${user?.owner?.reviewNote ? `: ${user.owner.reviewNote}` : ''}. Update your details and contact support.`
        : 'Your owner account is waiting for admin approval. You can add halls now; they go live once you and the hall are approved.'}
    </p>
  );
}

export function OwnerOverview() {
  const { data, isLoading, error } = useOwnerSummaryQuery();
  const user = useCurrentUser();
  const max = useMemo(() => Math.max(1, ...(data?.byMonth.map((m) => m.value) ?? [1])), [data]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={errorMessage(error)} />;
  const months = data.byMonth.slice(-8);

  return (
    <div className="stack">
      <h1>Vanakkam, {user?.name.split(' ')[0]}</h1>
      <OwnerStatusNotice />
      <motion.div className="stats" variants={stagger.container} initial="hidden" animate="show">
        {[
          [data.upcomingCount, 'upcoming bookings', (n: number) => Math.round(n).toLocaleString('en-IN')],
          [data.money.advanceCollected, 'advance collected online', (n: number) => inr(n)],
          [data.money.balanceDue, 'balance to collect at the hall', (n: number) => inr(n)],
          [data.money.payoutFromAdvance, 'paid out to you (after 5% fee)', (n: number) => inr(n)],
        ].map(([v, label, fmt]) => (
          <motion.div key={label as string} className="stat" variants={stagger.item}>
            <b>
              <CountUp value={v as number} format={fmt as (n: number) => string} />
            </b>
            <span>{label as string}</span>
          </motion.div>
        ))}
      </motion.div>

      {months.length > 0 && (
        <section className="panel">
          <h2>Bookings by event month</h2>
          <div className="bars" role="img" aria-label="Booked value per month">
            {months.map((m, i) => (
              <div className="bar" key={m.month} title={`${monthTitle(m.month)}: ${m.bookings} bookings, ${inr(m.value)}`}>
                <motion.i initial={{ height: 0 }} animate={{ height: `${(m.value / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                <span>
                  {monthTitle(m.month).slice(0, 3)}
                  <br />
                  {inrShort(m.value)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="spread">
          <h2>Next functions</h2>
          <Link to="/owner/bookings">All bookings</Link>
        </div>
        {data.nextBookings.length === 0 ? (
          <Empty title="No upcoming bookings yet">Once customers book your halls, they show up here.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hall</th>
                  <th>Session</th>
                  <th>Customer</th>
                  <th className="num">Balance due</th>
                </tr>
              </thead>
              <tbody>
                {data.nextBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link to={`/bookings/${b.id}`}>{shortDate(b.date)}</Link>
                    </td>
                    <td>{b.venue.name}</td>
                    <td>{SLOT_NAMES[b.slot.key]}</td>
                    <td>
                      {b.contact.name}
                      <div className="tiny muted">{EVENT_NAMES[b.eventKind] ?? b.eventKind}, {b.guests} guests</div>
                    </td>
                    <td className="num">{b.balanceStatus === 'DUE' ? inr(b.pricing.balance) : <span className="pill free">Paid</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function OwnerHalls() {
  const { data, isLoading, error } = useOwnerVenuesQuery();
  const [submit, { isLoading: submitting }] = useSubmitVenueMutation();
  const toast = useToast();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={errorMessage(error)} />;

  return (
    <div className="stack">
      <div className="spread">
        <h1>My halls</h1>
        <Link className="btn" to="/owner/halls/new">
          Add a hall
        </Link>
      </div>
      <OwnerStatusNotice />
      {data.items.length === 0 && (
        <Empty title="No halls yet" action={<Link className="btn" to="/owner/halls/new">Add your first hall</Link>}>
          Add the hall's sessions, prices and photos-to-come, then send it to admin for review.
        </Empty>
      )}
      <motion.div variants={stagger.container} initial="hidden" animate="show">
        {data.items.map((v) => (
          <motion.div key={v.id} className="hall-row" variants={stagger.item} style={{ cursor: 'default' }}>
            <div className="art">
              <HallArt seed={v.coverStyle} />
            </div>
            <div className="body">
              <div className="spread">
                <h2>{v.name}</h2>
                <span className={`pill ${v.status}`}>{v.status === 'approved' ? 'Live' : v.status === 'pending' ? 'In review' : v.status}</span>
              </div>
              <div className="where">
                {[v.address.area, v.address.city].filter(Boolean).join(', ')} — {v.capacity.seating.toLocaleString('en-IN')} seats, from {inr(v.minPrice)}
              </div>
              {v.reviewNote && <p className="notice bad small">Admin note: {v.reviewNote}</p>}
              <div className="row">
                <Link className="btn quiet sm" to={`/owner/halls/${v.id}`}>
                  Edit
                </Link>
                <Link className="btn quiet sm" to={`/owner/calendar?venue=${v.id}`}>
                  Calendar
                </Link>
                {v.status === 'approved' && (
                  <Link className="btn ghost sm" to={`/halls/${v.slug}`}>
                    View as customer
                  </Link>
                )}
                {['draft', 'rejected'].includes(v.status) && (
                  <button
                    className="btn sm"
                    disabled={submitting}
                    onClick={async () => {
                      try {
                        await submit(v.id).unwrap();
                        toast('Sent for review.');
                      } catch (e) {
                        toast(errorMessage(e), 'error');
                      }
                    }}
                  >
                    Send for review
                  </button>
                )}
                {v.upcomingBookings ? <span className="small muted">{v.upcomingBookings} upcoming bookings</span> : null}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export function OwnerCalendar() {
  const [sp, setSp] = useSearchParams();
  const { data: venues, isLoading } = useOwnerVenuesQuery();
  const venueId = sp.get('venue') ?? venues?.items[0]?.id;
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const { data: cal, isFetching, error } = useOwnerCalendarQuery({ id: venueId!, month }, { skip: !venueId });
  const [day, setDay] = useState<AvailabilityDay | null>(null);
  const [addBlock, { isLoading: blocking }] = useAddBlockMutation();
  const [removeBlock] = useRemoveBlockMutation();
  const [setPrice, { isLoading: pricing }] = useSetSpecialPriceMutation();
  const [note, setNote] = useState('');
  const [pct, setPct] = useState(20);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();

  if (isLoading) return <Loading />;
  if (!venues?.items.length) return <Empty title="Add a hall first" action={<Link className="btn" to="/owner/halls/new">Add a hall</Link>} />;

  const live = day ? cal?.days.find((d) => d.date === day.date) ?? day : null;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setActionError(null);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  return (
    <div className="stack">
      <div className="spread">
        <h1>Calendar</h1>
        <select className="input" style={{ width: 'auto' }} value={venueId} onChange={(e) => setSp({ venue: e.target.value })} aria-label="Hall">
          {venues.items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">Click a day to block it (for a booking you took over the phone, repairs, your own function) or to charge more on a busy muhurtham day.</p>
      {error && <ErrorBox message={errorMessage(error)} />}
      <div className="panel">
        <AvailabilityCalendar month={month} onMonth={setMonth} days={cal?.days} loading={isFetching} selected={day?.date} onSelect={setDay} ownerMode />
      </div>

      <Modal open={!!live} onClose={() => setDay(null)} title={live ? longDate(live.date) : ''}>
        {live && (
          <div className="stack">
            {(['MORNING', 'EVENING'] as UnitKey[]).map((u) => {
              const state = live.units[u];
              const b = live.bookings?.find((x) => x.slot === u || x.slot === 'FULL_DAY');
              return (
                <div key={u} className="spread panel flat" style={{ padding: 12 }}>
                  <div>
                    <b>{u === 'MORNING' ? 'Morning' : 'Evening'}</b>
                    <div className="small muted">
                      {state === 'free' && 'Free'}
                      {state === 'held' && 'A customer is paying right now'}
                      {state === 'booking' && b && (
                        <>
                          <Link to={`/bookings/${b.id}`}>{b.code}</Link>: {b.customer}, {EVENT_NAMES[b.eventKind] ?? b.eventKind}, {b.guests} guests
                        </>
                      )}
                      {state === 'block' && `Blocked${live.locks?.find((l) => l.unit === u)?.note ? `: ${live.locks.find((l) => l.unit === u)!.note}` : ''}`}
                    </div>
                  </div>
                  {state === 'block' && (
                    <button className="btn quiet sm" onClick={() => run(() => removeBlock({ id: venueId!, date: live.date, unit: u }).unwrap(), 'Unblocked.')}>
                      Unblock
                    </button>
                  )}
                </div>
              );
            })}
            {live.date >= todayISO() && (
              <>
                <label className="field">
                  <span>Note for a block (only you see it)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Booked over phone, Mr. Kannan" maxLength={80} />
                </label>
                <div className="row">
                  {(['MORNING', 'EVENING', 'FULL_DAY'] as SlotKey[]).map((s) => (
                    <button key={s} className="btn quiet sm" disabled={blocking} onClick={() => run(() => addBlock({ id: venueId!, date: live.date, slotKey: s, note: note || undefined }).unwrap(), `Blocked ${SLOT_NAMES[s].toLowerCase()}.`)}>
                      Block {SLOT_NAMES[s].toLowerCase()}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ alignItems: 'end' }}>
                  <label className="field" style={{ width: 150 }}>
                    <span>Price change</span>
                    <select value={pct} onChange={(e) => setPct(Number(e.target.value))}>
                      {[-20, -10, 0, 10, 15, 20, 25, 30, 50].map((p) => (
                        <option key={p} value={p}>
                          {p > 0 ? `+${p}%` : p === 0 ? 'Normal price' : `${p}%`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="btn sm" disabled={pricing} onClick={() => run(() => setPrice({ id: venueId!, date: live.date, percent: pct, note: pct > 0 ? 'Muhurtham day' : undefined }).unwrap(), pct === 0 ? 'Normal price restored.' : 'Price updated for this day.')}>
                    Apply to this day
                  </button>
                </div>
                {live.adjustmentPercent !== 0 && <p className="small muted">Currently {live.adjustmentPercent > 0 ? '+' : ''}{live.adjustmentPercent}% on this day.</p>}
              </>
            )}
            {actionError && <ErrorBox message={actionError} />}
          </div>
        )}
      </Modal>
    </div>
  );
}

const OWNER_TABS = [
  ['upcoming', 'Upcoming'],
  ['balance', 'Balance due'],
  ['past', 'Past'],
  ['cancelled', 'Cancelled'],
] as const;

export function OwnerBookings() {
  const [tab, setTab] = useState<(typeof OWNER_TABS)[number][0]>('upcoming');
  const [q, setQ] = useState('');
  const { data, isFetching, error } = useOwnerBookingsQuery({ status: tab, q: q || undefined });
  const [markPaid] = useMarkBalancePaidMutation();
  const toast = useToast();

  return (
    <div className="stack">
      <div className="spread">
        <h1>Bookings</h1>
        <input className="input" style={{ width: 240 }} type="search" placeholder="Code, name or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookings" />
      </div>
      <div className="tabs" role="tablist">
        {OWNER_TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={errorMessage(error)} />}
      {!data && isFetching && <Loading />}
      {data && data.items.length === 0 && <Empty title="Nothing here">No bookings match.</Empty>}
      <AnimatePresence mode="wait">
        {data && data.items.length > 0 && (
          <motion.div key={tab} className="table-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Code</th>
                  <th>Hall and session</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{shortDate(b.date)}</td>
                    <td>
                      <Link to={`/bookings/${b.id}`}>{b.code}</Link>
                    </td>
                    <td>
                      {b.venue.name}
                      <div className="tiny muted">{SLOT_NAMES[b.slot.key]}</div>
                    </td>
                    <td>
                      {b.contact.name}
                      {b.contact.phone && <div className="tiny muted">{b.contact.phone}</div>}
                    </td>
                    <td>
                      <StatusPill status={b.status} />
                    </td>
                    <td className="num">{inr(b.pricing.total)}</td>
                    <td className="num">
                      {b.balanceStatus === 'PAID_AT_VENUE' ? (
                        <span className="pill free">Received</span>
                      ) : ['CONFIRMED', 'COMPLETED'].includes(b.status) ? (
                        <button
                          className="btn quiet sm"
                          onClick={async () => {
                            try {
                              await markPaid(b.id).unwrap();
                              toast(`Balance of ${inr(b.pricing.balance)} marked received.`);
                            } catch (e) {
                              toast(errorMessage(e), 'error');
                            }
                          }}
                        >
                          Mark {inr(b.pricing.balance)} received
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
