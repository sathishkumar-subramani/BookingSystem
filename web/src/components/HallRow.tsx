import { Link } from 'react-router';
import { motion } from 'motion/react';
import type { VenueCard } from '../api/types';
import { inr, plural, SLOT_NAMES } from '../utils/format';
import { HallArt } from './HallArt';
import { stagger } from './ui';

const MotionLink = motion.create(Link);

export function HallRow({ venue, date }: { venue: VenueCard; date?: string }) {
  const to = `/halls/${venue.slug}${date ? `?date=${date}` : ''}`;
  return (
    <MotionLink
      to={to}
      className="hall-row"
      variants={stagger.item}
      whileHover={{ y: -3, boxShadow: '0 18px 40px -22px rgba(34,26,28,.45)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="art" style={{ overflow: 'hidden' }}>
        <motion.div style={{ height: '100%' }} whileHover={{ scale: 1.06 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <HallArt seed={venue.coverStyle} />
        </motion.div>
      </div>
      <div className="body">
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2>{venue.name}</h2>
            <div className="where">
              {[venue.address.area, venue.address.city].filter(Boolean).join(', ')}
              {venue.distanceKm != null && <> — {venue.distanceKm} km away</>}
            </div>
          </div>
          {venue.amenities.includes('ac') && <span className="pill zari">AC</span>}
        </div>
        {venue.tagline && <div className="small muted">{venue.tagline}</div>}
        <div className="facts">
          <span>
            <b>{venue.capacity.seating.toLocaleString('en-IN')}</b> seated
          </span>
          <span>
            <b>{venue.capacity.dining.toLocaleString('en-IN')}</b> dining
          </span>
          {venue.rooms > 0 && <span>{plural(venue.rooms, 'room')}</span>}
          {venue.parkingCars > 0 && <span>{plural(venue.parkingCars, 'car')} parking</span>}
        </div>
        <div className="price-line">
          <span>
            <span className="small muted">from </span>
            <span className="from">{inr(venue.minPrice)}</span>
          </span>
          {date ? (
            <span className="slot-pips" aria-label="Sessions on your date">
              {venue.slots.map((s) => (
                <span key={s.key} className={`pill ${s.available ? 'free' : 'taken'}`}>
                  {SLOT_NAMES[s.key]} {s.available ? 'free' : 'booked'}
                </span>
              ))}
            </span>
          ) : (
            <span className="small muted">{venue.advancePercent}% advance to book</span>
          )}
        </div>
      </div>
    </MotionLink>
  );
}
