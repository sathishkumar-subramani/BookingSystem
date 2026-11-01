import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useAvailabilityQuery, useCatalogQuery, useCreateBookingMutation, useVenueQuery } from '../api/api';
import { errorCode, errorMessage } from '../api/baseQuery';
import type { AvailabilityDay, SlotKey } from '../api/types';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { HallArt } from '../components/HallArt';
import { SilkBorder } from '../components/SilkBorder';
import { ErrorBox, Loading, Reveal, useToast } from '../components/ui';
import { useCurrentUser } from '../store';
import { clock, describeRules, EVENT_NAMES, inr, longDate, POLICY_NAMES, todayISO } from '../utils/format';

export function Venue() {
  const { slug = '' } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const user = useCurrentUser();
  const { data: catalog } = useCatalogQuery();
  const { data, error, isLoading } = useVenueQuery(slug);
  const venue = data?.venue;

  const initialDate = sp.get('date') ?? undefined;
  const [month, setMonth] = useState((initialDate ?? todayISO()).slice(0, 7));
  const [date, setDate] = useState<string | undefined>(initialDate);
  const [slot, setSlot] = useState<SlotKey | undefined>((sp.get('slot') as SlotKey) || undefined);
  const [guests, setGuests] = useState<number>(Number(sp.get('guests')) || 300);
  const [eventKind, setEventKind] = useState('wedding');
  const { data: avail, isFetching: availLoading } = useAvailabilityQuery({ id: slug, month }, { skip: !venue });
  const [createBooking, { isLoading: holding }] = useCreateBookingMutation();
  const [holdError, setHoldError] = useState<string | null>(null);

  const day: AvailabilityDay | undefined = useMemo(() => avail?.days.find((d) => d.date === date), [avail, date]);
  const daySlot = day?.slots.find((s) => s.key === slot);
  useEffect(() => {
    // If the chosen session isn't free on the chosen day, clear it so the panel doesn't lie.
    if (day && slot && !day.slots.find((s) => s.key === slot)?.available) setSlot(undefined);
  }, [day, slot]);

  if (isLoading) return <div className="container"><Loading text="Opening the hall…" /></div>;
  if (error || !venue) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <ErrorBox message={errorMessage(error, 'This hall could not be found.')} />
        <Link to="/halls">Back to all halls</Link>
      </div>
    );
  }

  const price = daySlot?.price ?? venue.slots.find((s) => s.key === slot)?.price ?? 0;
  const advance = Math.min(price, Math.round((price * venue.advancePercent) / 100 / 100) * 100);
  const type = catalog?.venueTypes.find((t) => t.key === venue.typeKey);

  const hold = async () => {
    setHoldError(null);
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`${location.pathname}?date=${date ?? ''}&slot=${slot ?? ''}&guests=${guests}`)}`);
      return;
    }
    if (!date || !slot) return;
    try {
      const res = await createBooking({ venueId: venue.id, date, slotKey: slot, guests, eventKind }).unwrap();
      navigate(`/checkout/${res.booking.id}`);
    } catch (err) {
      setHoldError(errorMessage(err));
      if (errorCode(err) === 'SLOT_TAKEN') toast('That session was just taken. The calendar has been refreshed.', 'error');
    }
  };

  return (
    <>
      <div className="venue-hero">
        <motion.div className="art" initial={{ scale: 1.08, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
          <HallArt seed={venue.coverStyle} wide />
        </motion.div>
        <SilkBorder thin />
      </div>
      <div className="container">
        <div className="venue-layout">
          <div>
            <motion.div className="venue-title" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Link to={`/halls?district=${encodeURIComponent(venue.address.district)}`} className="small">
                {venue.address.district}
              </Link>
              <h1>{venue.name}</h1>
              <p className="muted">
                {[venue.address.line1, venue.address.city, venue.address.pincode].filter(Boolean).join(', ')}
                {venue.host && <> — run by {venue.host.name}</>}
              </p>
            </motion.div>

            <div className="fact-grid">
              {[
                [venue.capacity.seating, 'seated in the hall'],
                [venue.capacity.dining, 'per dining sitting'],
                [venue.rooms, 'rooms for families'],
                [venue.parkingCars, 'cars can park'],
              ].map(([n, label], i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.07 }}>
                  <b>{Number(n).toLocaleString('en-IN')}</b>
                  <span>{label}</span>
                </motion.div>
              ))}
            </div>

            {venue.description && <p className="prose">{venue.description}</p>}

            <Reveal className="section-gap">
              <h2>Sessions and prices</h2>
              <table className="sessions">
                <tbody>
                  {venue.slots.map((s) => (
                    <tr key={s.key}>
                      <td>
                        <b>{s.label}</b>
                        <div className="small muted">
                          {clock(s.start)} to {clock(s.end)}
                        </div>
                      </td>
                      <td>{inr(s.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted" style={{ marginTop: 8 }}>
                Pay {venue.advancePercent}% online to book; the rest is paid at the hall. Some peak days cost more — they're marked with a gold diamond on the calendar.
              </p>
            </Reveal>

            <Reveal className="section-gap">
              <h2>What's included</h2>
              <ul className="amenities">
                {venue.amenities.map((a) => (
                  <li key={a}>{catalog?.amenities.find((x) => x.key === a)?.label ?? a}</li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="section-gap">
              <h2>If plans change</h2>
              <p>
                <b>{POLICY_NAMES[venue.cancellationPolicy]} policy.</b> Refunds are on the advance:
              </p>
              <ul>
                {describeRules(venue.cancellationRules).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="small muted">If the hall cancels on you, the whole advance comes back.</p>
            </Reveal>
          </div>

          <motion.aside className="panel book-panel" aria-label="Book this hall" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>
            <h2>Check a date</h2>
            <AvailabilityCalendar
              month={month}
              days={avail?.days}
              loading={availLoading}
              selected={date}
              minMonth={todayISO().slice(0, 7)}
              onMonth={setMonth}
              onSelect={(d) => {
                setDate(d.date);
                const firstFree = d.slots.find((s) => s.available);
                if (!slot || !d.slots.find((s) => s.key === slot)?.available) setSlot(firstFree?.key);
              }}
            />

            <AnimatePresence initial={false}>
              {date && day && (
                <motion.div key="picker" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <div className="stack" style={{ marginTop: 18 }}>
                    <div className="spread">
                      <b>{longDate(date)}</b>
                      {day.adjustmentPercent > 0 && <span className="pill zari">Peak day +{day.adjustmentPercent}%</span>}
                    </div>
                    <div className="chips" role="group" aria-label="Session">
                      {venue.slots.map((s) => {
                        const st = day.slots.find((x) => x.key === s.key);
                        return (
                          <motion.button key={s.key} className="chip" aria-pressed={slot === s.key} disabled={!st?.available} onClick={() => setSlot(s.key)} whileTap={{ scale: 0.95 }}>
                            {s.label}
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="field-grid">
                      <label className="field">
                        <span>Guests</span>
                        <input type="number" min={1} max={venue.capacity.seating} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
                      </label>
                      <label className="field">
                        <span>Function</span>
                        <select value={eventKind} onChange={(e) => setEventKind(e.target.value)}>
                          {(type?.eventKinds ?? ['wedding']).map((k) => (
                            <option key={k} value={k}>
                              {EVENT_NAMES[k] ?? k}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {guests > venue.capacity.seating && <p className="small" style={{ color: 'var(--danger)' }}>This hall seats {venue.capacity.seating.toLocaleString('en-IN')}.</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {date && slot && price > 0 && (
                <motion.div key={`${date}${slot}`} className="breakdown" style={{ marginTop: 18 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div>
                    <span>Hall charge</span>
                    <span>{inr(price)}</span>
                  </div>
                  <div className="total">
                    <span>Pay now ({venue.advancePercent}% advance)</span>
                    <span className="now">{inr(advance)}</span>
                  </div>
                  <div className="muted">
                    <span>Balance at the hall</span>
                    <span>{inr(price - advance)}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {holdError && <ErrorBox message={holdError} />}
            <motion.button
              className="btn block big"
              style={{ marginTop: 18 }}
              disabled={!date || !slot || holding || guests < 1 || guests > venue.capacity.seating}
              onClick={hold}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
            >
              {holding ? 'Holding…' : !date ? 'Pick a date' : !slot ? 'Pick a session' : user ? 'Hold for 10 minutes' : 'Sign in to book'}
            </motion.button>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Nobody else can book this session while you pay. If you don't finish in {catalog?.booking.holdMinutes ?? 10} minutes it is released.
            </p>
          </motion.aside>
        </div>
      </div>
    </>
  );
}
