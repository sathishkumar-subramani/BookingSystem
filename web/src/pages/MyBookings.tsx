import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useMyBookingsQuery } from '../api/api';
import { errorMessage } from '../api/baseQuery';
import { HallArt } from '../components/HallArt';
import { Empty, ErrorBox, Loading, StatusPill, stagger } from '../components/ui';
import { inr, longDate } from '../utils/format';

const TABS = [
  ['upcoming', 'Upcoming'],
  ['past', 'Past'],
  ['cancelled', 'Cancelled'],
] as const;

export function MyBookings() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('upcoming');
  const { data, isFetching, error } = useMyBookingsQuery({ status: tab });

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <h1 style={{ marginTop: 28 }}>My bookings</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ position: 'relative' }}>
            {label}
            {tab === k && <motion.span layoutId="tab-underline" style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, background: 'var(--primary)' }} />}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={errorMessage(error)} />}
      {!data && isFetching && <Loading />}
      {data && data.items.length === 0 && (
        <Empty title={tab === 'upcoming' ? 'No upcoming bookings' : `No ${tab} bookings`} action={tab === 'upcoming' && <Link className="btn" to="/halls">Find a hall</Link>}>
          {tab === 'upcoming' ? 'When you book a hall it shows up here with its booking code.' : null}
        </Empty>
      )}
      <AnimatePresence mode="wait">
        {data && data.items.length > 0 && (
          <motion.div key={tab} variants={stagger.container} initial="hidden" animate="show" exit={{ opacity: 0 }}>
            {data.items.map((b) => (
              <motion.div key={b.id} variants={stagger.item}>
                <Link to={b.status === 'HELD' ? `/checkout/${b.id}` : `/bookings/${b.id}`} className="hall-row" style={{ gridTemplateColumns: undefined }}>
                  <div className="art" style={{ minHeight: 120 }}>
                    <HallArt seed={b.venue.coverStyle} />
                  </div>
                  <div className="body">
                    <div className="spread">
                      <h2>{b.venue.name}</h2>
                      <StatusPill status={b.status} />
                    </div>
                    <div className="where">
                      {longDate(b.date)}, {b.slot.label.toLowerCase()} — {b.venue.city}
                    </div>
                    <div className="price-line">
                      <span className="small muted">{b.code}</span>
                      <span>
                        <b>{inr(b.pricing.total)}</b>
                        <span className="small muted"> total</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
