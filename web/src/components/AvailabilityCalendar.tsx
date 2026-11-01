import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { AvailabilityDay, UnitKey } from '../api/types';
import { monthTitle, shiftMonth, todayISO } from '../utils/format';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UNITS: UnitKey[] = ['MORNING', 'EVENING'];

interface Props {
  month: string;
  days: AvailabilityDay[] | undefined;
  loading?: boolean;
  selected?: string;
  onSelect: (day: AvailabilityDay) => void;
  onMonth: (month: string) => void;
  /** owner view: every day is clickable, not just bookable ones */
  ownerMode?: boolean;
  minMonth?: string;
}

/**
 * Month grid where each day is split in two: top bar = morning, bottom bar = evening.
 * Green = free, striped gold = someone is paying right now, maroon = booked, hatched = owner blocked.
 * A small gold diamond marks a peak-price day.
 */
export function AvailabilityCalendar({ month, days, loading, selected, onSelect, onMonth, ownerMode, minMonth }: Props) {
  const [dir, setDir] = useState(1);
  const first = new Date(`${month}-01T00:00:00`).getDay();
  const today = todayISO();
  const go = (n: number) => {
    setDir(n);
    onMonth(shiftMonth(month, n));
  };

  return (
    <div>
      <div className="cal-head">
        <button className="icon-btn" onClick={() => go(-1)} disabled={!!minMonth && month <= minMonth} aria-label="Previous month">
          ‹
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h3 key={month} initial={{ opacity: 0, y: dir * 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -dir * 6 }} transition={{ duration: 0.18 }}>
            {monthTitle(month)}
          </motion.h3>
        </AnimatePresence>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="cal" role="grid" aria-label={`Availability for ${monthTitle(month)}`}>
        {DOW.map((d) => (
          <div key={d} className="dow" role="columnheader">
            {d}
          </div>
        ))}
      </div>
      <div style={{ overflow: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={month}
            className="cal"
            custom={dir}
            initial={{ x: dir * 40, opacity: 0 }}
            animate={{ x: 0, opacity: loading ? 0.45 : 1 }}
            exit={{ x: -dir * 40, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {Array.from({ length: first }, (_, i) => (
              <div key={`pad${i}`} />
            ))}
            {(days ?? []).map((d) => {
              const clickable = ownerMode ? d.date >= today : d.bookable && d.slots.some((s) => s.available);
              const label = `${d.date}: morning ${d.units.MORNING}, evening ${d.units.EVENING}${d.adjustmentPercent ? `, peak price +${d.adjustmentPercent}%` : ''}`;
              return (
                <motion.button
                  key={d.date}
                  type="button"
                  className={`day${selected === d.date ? ' selected' : ''}${d.date === today ? ' today' : ''}`}
                  disabled={!clickable}
                  onClick={() => onSelect(d)}
                  aria-label={label}
                  aria-pressed={selected === d.date}
                  whileHover={clickable ? { scale: 1.06, zIndex: 2 } : undefined}
                  whileTap={clickable ? { scale: 0.96 } : undefined}
                >
                  <span className="num">{Number(d.date.slice(8))}</span>
                  {UNITS.map((u) => (
                    <span key={u} className={`half ${d.units[u]}`} />
                  ))}
                  {d.adjustmentPercent > 0 && <span className="peak" title={`${d.specialNote ?? 'Peak day'} +${d.adjustmentPercent}%`} />}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="legend" aria-hidden>
        <span>
          <i className="half free" /> Free
        </span>
        <span>
          <i className="half held" /> Someone is paying
        </span>
        <span>
          <i className="half taken" /> Booked
        </span>
        {ownerMode && (
          <span>
            <i className="half block" /> Blocked by you
          </span>
        )}
        <span>
          <i className="peak-key" /> Peak price
        </span>
        <span>Top bar morning, bottom bar evening</span>
      </div>
    </div>
  );
}
