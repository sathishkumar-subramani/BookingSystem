import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  useAdminBookingsQuery,
  useAdminOwnersQuery,
  useAdminSummaryQuery,
  useAdminUsersQuery,
  useAdminVenuesQuery,
  useAdminVenueTypesQuery,
  useCancelBookingMutation,
  useReviewOwnerMutation,
  useReviewVenueMutation,
  useSetUserStatusMutation,
  useSetVenueTypeEnabledMutation,
} from '../../api/api';
import { errorMessage } from '../../api/baseQuery';
import { HallArt } from '../../components/HallArt';
import { CountUp, Empty, ErrorBox, Loading, Modal, StatusPill, stagger, useToast } from '../../components/ui';
import { inr, shortDate, SLOT_NAMES } from '../../utils/format';

export function AdminLayout() {
  const { data } = useAdminSummaryQuery();
  const pending = (data?.pendingOwners ?? 0) + (data?.venues.pending ?? 0);
  return (
    <div className="container">
      <div className="console">
        <nav className="side-nav" aria-label="Admin">
          <NavLink to="/admin" end>
            Overview
          </NavLink>
          <NavLink to="/admin/approvals">Approvals {pending > 0 && <span className="count">{pending}</span>}</NavLink>
          <NavLink to="/admin/bookings">Bookings</NavLink>
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function AdminOverview() {
  const { data, isLoading, error } = useAdminSummaryQuery();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={errorMessage(error)} />;
  const confirmed = (data.bookings.CONFIRMED ?? 0) + (data.bookings.COMPLETED ?? 0);
  return (
    <div className="stack">
      <h1>Platform overview</h1>
      {(data.pendingOwners > 0 || (data.venues.pending ?? 0) > 0) && (
        <p className="notice">
          {data.pendingOwners} owner{data.pendingOwners === 1 ? '' : 's'} and {data.venues.pending ?? 0} hall{data.venues.pending === 1 ? '' : 's'} waiting for review. <Link to="/admin/approvals">Review now</Link>
        </p>
      )}
      <motion.div className="stats" variants={stagger.container} initial="hidden" animate="show">
        {[
          [data.money.gmv, 'booked value', inr],
          [data.money.platformFees, 'platform fees earned', inr],
          [data.money.advances, 'advances collected', inr],
          [data.money.refunds, `refunded (${data.money.refundCount})`, inr],
          [confirmed, 'paid bookings', (n: number) => Math.round(n).toLocaleString('en-IN')],
          [data.venues.approved ?? 0, 'live halls', (n: number) => Math.round(n).toLocaleString('en-IN')],
          [data.users.owner ?? 0, 'hall owners', (n: number) => Math.round(n).toLocaleString('en-IN')],
          [data.users.user ?? 0, 'customers', (n: number) => Math.round(n).toLocaleString('en-IN')],
        ].map(([v, label, fmt]) => (
          <motion.div key={label as string} className="stat" variants={stagger.item}>
            <b>
              <CountUp value={v as number} format={fmt as (n: number) => string} />
            </b>
            <span>{label as string}</span>
          </motion.div>
        ))}
      </motion.div>
      <h2 style={{ marginTop: 20 }}>Latest bookings</h2>
      <BookingTable items={data.recentBookings} />
    </div>
  );
}

function BookingTable({ items, onCancel }: { items: import('../../api/types').Booking[]; onCancel?: (id: string) => void }) {
  if (!items.length) return <Empty title="No bookings" />;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Code</th>
            <th>Date</th>
            <th>Hall</th>
            <th>Customer</th>
            <th>Status</th>
            <th className="num">Total</th>
            <th className="num">Fee</th>
            {onCancel && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id}>
              <td>
                <Link to={`/bookings/${b.id}`}>{b.code}</Link>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {shortDate(b.date)}
                <div className="tiny muted">{SLOT_NAMES[b.slot.key]}</div>
              </td>
              <td>
                {b.venue.name}
                <div className="tiny muted">{b.venue.city}</div>
              </td>
              <td>{b.customer?.name ?? b.contact.name}</td>
              <td>
                <StatusPill status={b.status} />
              </td>
              <td className="num">{inr(b.pricing.total)}</td>
              <td className="num">{inr(b.pricing.platformFee)}</td>
              {onCancel && (
                <td>
                  {b.status === 'CONFIRMED' && (
                    <button className="btn danger sm" onClick={() => onCancel(b.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewModal({ target, onClose }: { target: { kind: 'owner' | 'venue'; id: string; name: string; action: 'reject' | 'suspend' } | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [reviewOwner, o] = useReviewOwnerMutation();
  const [reviewVenue, v] = useReviewVenueMutation();
  const toast = useToast();
  const busy = o.isLoading || v.isLoading;
  const err = o.error || v.error;
  const go = async () => {
    if (!target) return;
    try {
      if (target.kind === 'owner') await reviewOwner({ id: target.id, action: 'reject', note }).unwrap();
      else await reviewVenue({ id: target.id, action: target.action, note }).unwrap();
      toast(`${target.name} ${target.action === 'suspend' ? 'suspended' : 'rejected'}.`);
      setNote('');
      onClose();
    } catch {
      /* shown */
    }
  };
  return (
    <Modal open={!!target} onClose={onClose} title={target ? `${target.action === 'suspend' ? 'Suspend' : 'Reject'} ${target.name}?` : ''}>
      <div className="stack">
        <label className="field">
          <span>Note to the owner</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} required placeholder="What needs fixing before this can go live" />
        </label>
        {err && <ErrorBox message={errorMessage(err)} />}
        <div className="row">
          <button className="btn danger" disabled={busy || !note.trim()} onClick={go}>
            {target?.action === 'suspend' ? 'Suspend' : 'Reject'}
          </button>
          <button className="btn quiet" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AdminApprovals() {
  const owners = useAdminOwnersQuery({ status: 'pending' });
  const venues = useAdminVenuesQuery({ status: 'pending' });
  const [reviewOwner] = useReviewOwnerMutation();
  const [reviewVenue] = useReviewVenueMutation();
  const [target, setTarget] = useState<Parameters<typeof ReviewModal>[0]['target']>(null);
  const toast = useToast();

  const approveOwner = async (id: string, name: string) => {
    try {
      await reviewOwner({ id, action: 'approve' }).unwrap();
      toast(`${name} approved.`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const approveVenue = async (id: string, name: string) => {
    try {
      await reviewVenue({ id, action: 'approve' }).unwrap();
      toast(`${name} is live.`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div className="stack">
      <h1>Approvals</h1>
      <h2>Hall owners</h2>
      {owners.isLoading ? (
        <Loading />
      ) : owners.data?.items.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Business</th>
                <th>Contact</th>
                <th>Halls</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {owners.data.items.map((u) => (
                  <motion.tr key={u.id} exit={{ opacity: 0, x: 30 }} layout>
                    <td>{u.name}</td>
                    <td>
                      {u.owner?.businessName}
                      <div className="tiny muted">{u.owner?.city}</div>
                    </td>
                    <td>
                      {u.email}
                      <div className="tiny muted">{u.phone}</div>
                    </td>
                    <td>{u.venueCount}</td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <button className="btn sm" onClick={() => approveOwner(u.id, u.name)}>
                          Approve
                        </button>
                        <button className="btn danger sm" onClick={() => setTarget({ kind: 'owner', id: u.id, name: u.name, action: 'reject' })}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No owners waiting.</p>
      )}

      <h2 style={{ marginTop: 24 }}>Halls</h2>
      {venues.isLoading ? (
        <Loading />
      ) : venues.data?.items.length ? (
        <AnimatePresence>
          {venues.data.items.map((v) => (
            <motion.div key={v.id} className="hall-row" layout exit={{ opacity: 0, x: 40 }} style={{ cursor: 'default' }}>
              <div className="art">
                <HallArt seed={v.coverStyle} />
              </div>
              <div className="body">
                <div className="spread">
                  <h2>{v.name}</h2>
                  {v.owner && <span className={`pill ${v.owner.status}`}>Owner {v.owner.status}</span>}
                </div>
                <div className="where">
                  {[v.address.line1, v.address.city, v.address.district].filter(Boolean).join(', ')} — by {v.owner?.businessName ?? v.owner?.name}
                </div>
                <div className="facts">
                  <span>{v.capacity.seating} seats</span>
                  {v.slots
                    .filter((s) => s.enabled)
                    .map((s) => (
                      <span key={s.key}>
                        {SLOT_NAMES[s.key]} {inr(s.price)}
                      </span>
                    ))}
                  <span>{v.advancePercent}% advance</span>
                </div>
                <div className="row">
                  <button className="btn sm" onClick={() => approveVenue(v.id, v.name)} disabled={v.owner?.status !== 'approved'} title={v.owner?.status !== 'approved' ? 'Approve the owner first' : undefined}>
                    Approve and publish
                  </button>
                  <button className="btn danger sm" onClick={() => setTarget({ kind: 'venue', id: v.id, name: v.name, action: 'reject' })}>
                    Reject
                  </button>
                  {v.owner?.status !== 'approved' && <span className="tiny muted">Approve the owner first</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      ) : (
        <p className="muted">No halls waiting.</p>
      )}
      <ReviewModal target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

export function AdminBookings() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useAdminBookingsQuery({ status: status || undefined, q: q || undefined, page });
  const [cancelId, setCancelId] = useState<string | null>(null);
  return (
    <div className="stack">
      <div className="spread">
        <h1>All bookings</h1>
        <div className="row">
          <input className="input" style={{ width: 200 }} type="search" placeholder="Code, hall or name" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} aria-label="Search" />
          <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} aria-label="Status">
            <option value="">Every status</option>
            {['CONFIRMED', 'HELD', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <ErrorBox message={errorMessage(error)} />}
      {!data && isFetching ? <Loading /> : data && <BookingTable items={data.items} onCancel={setCancelId} />}
      {data && data.pages > 1 && (
        <nav className="pager">
          <button className="btn quiet sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="small muted">
            Page {data.page} of {data.pages}
          </span>
          <button className="btn quiet sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </nav>
      )}
      <AdminCancel id={cancelId} onClose={() => setCancelId(null)} />
    </div>
  );
}

function AdminCancel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const toast = useToast();
  const [cancel, { isLoading, error }] = useCancelBookingMutation();
  const go = async () => {
    if (!id) return;
    try {
      await cancel({ id, reason, as: 'admin' }).unwrap();
      toast('Cancelled with a full refund to the customer.');
      onClose();
    } catch {
      /* shown */
    }
  };
  return (
    <Modal open={!!id} onClose={onClose} title="Cancel this booking?">
      <div className="stack">
        <p>The customer gets the whole advance back.</p>
        <label className="field">
          <span>Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <ErrorBox message={errorMessage(error)} />}
        <button className="btn danger" onClick={go} disabled={isLoading}>
          Cancel and refund
        </button>
      </div>
    </Modal>
  );
}

export function AdminUsers() {
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const { data, isFetching, error } = useAdminUsersQuery({ role: role || undefined, q: q || undefined });
  const [setStatus] = useSetUserStatusMutation();
  const toast = useToast();
  return (
    <div className="stack">
      <div className="spread">
        <h1>Users</h1>
        <div className="row">
          <input className="input" style={{ width: 200 }} type="search" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
          <select className="input" style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="">Everyone</option>
            <option value="user">Customers</option>
            <option value="owner">Owners</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>
      {error && <ErrorBox message={errorMessage(error)} />}
      {!data && isFetching && <Loading />}
      {data && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    {u.owner?.businessName && <div className="tiny muted">{u.owner.businessName}</div>}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={`pill ${u.status}`}>{u.status}</span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <button
                        className={`btn sm ${u.status === 'active' ? 'danger' : 'quiet'}`}
                        onClick={async () => {
                          try {
                            await setStatus({ id: u.id, status: u.status === 'active' ? 'suspended' : 'active' }).unwrap();
                            toast(`${u.name} ${u.status === 'active' ? 'suspended' : 'reactivated'}.`);
                          } catch (e) {
                            toast(errorMessage(e), 'error');
                          }
                        }}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminCategories() {
  const { data, isLoading } = useAdminVenueTypesQuery();
  const [setEnabled, { isLoading: saving }] = useSetVenueTypeEnabledMutation();
  const toast = useToast();
  if (isLoading) return <Loading />;
  return (
    <div className="stack">
      <h1>Categories</h1>
      <p className="muted">
        Each category uses a booking engine. Marriage and party halls share the "whole venue per session" engine. Gyms (memberships) and concerts (tickets) need their own engines before they can be switched on.
      </p>
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="stack">
        {data?.items.map((t) => (
          <motion.div key={t.key} className="panel spread" variants={stagger.item}>
            <div>
              <h3 style={{ marginBottom: 2 }}>
                {t.name} {t.tamilName && <span className="tamil muted small">{t.tamilName}</span>}
              </h3>
              <div className="small muted">{t.description}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>
                Engine: {t.bookingMode.toLowerCase()} {t.modeImplemented ? '(ready)' : '(not built yet)'}
              </div>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={t.enabled}
                disabled={saving || (!t.modeImplemented && !t.enabled)}
                onChange={async (e) => {
                  try {
                    await setEnabled({ key: t.key, enabled: e.target.checked }).unwrap();
                    toast(`${t.name} ${e.target.checked ? 'switched on' : 'switched off'}.`);
                  } catch (err) {
                    toast(errorMessage(err), 'error');
                  }
                }}
              />
              {t.enabled ? 'On' : t.modeImplemented ? 'Off' : 'Coming soon'}
            </label>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
