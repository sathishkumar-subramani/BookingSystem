import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useCatalogQuery, useSearchVenuesQuery } from '../api/api';
import type { SlotKey } from '../api/types';
import { Anim } from '../components/Anim';
import { HallRow } from '../components/HallRow';
import { SilkBorder } from '../components/SilkBorder';
import { Reveal, stagger, useToast } from '../components/ui';
import { addDaysISO, todayISO } from '../utils/format';

const POPULAR = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Thanjavur', 'Erode', 'Tiruppur'];

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { data: catalog } = useCatalogQuery();
  const { data: featured } = useSearchVenuesQuery({ sort: 'capacity_desc', page: 1 });
  const [district, setDistrict] = useState('Chennai');
  const [date, setDate] = useState(addDaysISO(todayISO(), 30));
  const [slot, setSlot] = useState<SlotKey>('MORNING');
  const [guests, setGuests] = useState(500);
  const [locating, setLocating] = useState(false);

  // Gentle parallax: the lamp sinks and the petals drift slower than the page as you scroll.
  const { scrollY } = useScroll();
  const lampY = useTransform(scrollY, [0, 500], [0, reduce ? 0 : 60]);
  const petalsY = useTransform(scrollY, [0, 500], [0, reduce ? 0 : -40]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ district, date, slot, guests: String(guests) });
    navigate(`/halls?${q}`);
  };

  const nearMe = () => {
    if (!navigator.geolocation) return toast('Your browser cannot share location. Pick a district instead.', 'error');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const q = new URLSearchParams({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4), date, slot, guests: String(guests), radiusKm: '30' });
        navigate(`/halls?${q}`);
      },
      () => {
        setLocating(false);
        toast('Location was not shared. Pick a district instead.', 'error');
      },
      { timeout: 10_000 },
    );
  };

  const comingSoon = catalog?.venueTypes.filter((t) => !t.enabled) ?? [];
  const hallCount = featured?.total;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <motion.div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.55, y: petalsY, pointerEvents: 'none' }}>
          <Anim name="petals-drift" style={{ width: '100%', height: '100%' }} />
        </motion.div>
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'relative' }}>
          <Anim name="thoranam" fit="cover-top" style={{ width: '100%', height: 'clamp(90px, 11vw, 150px)', marginBottom: 6 }} />
        </motion.div>
        <div className="container hero-grid" style={{ position: 'relative' }}>
          <div>
            <motion.p className="tamil-line tamil" {...rise(0.15)}>
              உங்கள் முகூர்த்த நாளுக்கு ஒரு மண்டபம்
            </motion.p>
            <motion.h1 id="hero-title" {...rise(0.25)}>
              Book the mandapam for your muhurtham
            </motion.h1>
            <motion.p className="lede" {...rise(0.35)}>
              {hallCount ? `${hallCount} kalyana mandapams` : 'Kalyana mandapams'} across Tamil Nadu. See which sessions are free on your date and hold one for 10 minutes while you pay the
              advance.
            </motion.p>
            <motion.form className="sentence" onSubmit={search} {...rise(0.48)} aria-label="Search halls">
              We need a hall in{' '}
              <select className="slot-in" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District">
                {(catalog?.districts ?? POPULAR.map((name) => ({ name }))).map((d) => (
                  <option key={d.name}>{d.name}</option>
                ))}
              </select>{' '}
              on{' '}
              <input className="slot-in" type="date" value={date} min={addDaysISO(todayISO(), 1)} onChange={(e) => setDate(e.target.value)} aria-label="Date" required />
              {' '}for the{' '}
              <select className="slot-in" value={slot} onChange={(e) => setSlot(e.target.value as SlotKey)} aria-label="Session">
                <option value="MORNING">morning muhurtham</option>
                <option value="EVENING">evening reception</option>
                <option value="FULL_DAY">full day</option>
              </select>{' '}
              with about{' '}
              <input className="slot-in" type="number" min={10} max={20000} step={50} value={guests} onChange={(e) => setGuests(Number(e.target.value))} aria-label="Guests" />{' '}
              guests.
              <div className="actions">
                <motion.button className="btn big" type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  Show free halls
                </motion.button>
                <motion.button className="btn big quiet" type="button" onClick={nearMe} disabled={locating} whileTap={{ scale: 0.98 }}>
                  {locating ? 'Finding you…' : 'Halls near me'}
                </motion.button>
              </div>
            </motion.form>
          </div>
          <motion.div className="hero-lamp" style={{ y: lampY }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.5 }}>
            <Anim name="lamp" label="A lit kuthuvilakku" style={{ width: '100%', height: '100%' }} stillFrame={20} />
          </motion.div>
        </div>
        <SilkBorder reveal />
      </section>

      <div className="container">
        <section className="home-section">
          <Reveal>
            <div className="spread">
              <h2>Popular districts</h2>
              <Link to="/halls">See all halls</Link>
            </div>
          </Reveal>
          <motion.div className="chips" variants={stagger.container} initial="hidden" whileInView="show" viewport={{ once: true }}>
            {POPULAR.map((d) => (
              <motion.span key={d} variants={stagger.item}>
                <Link className="chip" to={`/halls?district=${encodeURIComponent(d)}`}>
                  {d}
                </Link>
              </motion.span>
            ))}
          </motion.div>
        </section>

        {featured && featured.items.length > 0 && (
          <section className="home-section">
            <Reveal>
              <h2>Large halls for big weddings</h2>
              <p className="muted">Seating for a thousand or more, with parking and dining on site.</p>
            </Reveal>
            <motion.div variants={stagger.container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
              {featured.items.slice(0, 4).map((v) => (
                <HallRow key={v.id} venue={v} />
              ))}
            </motion.div>
          </section>
        )}

        <section className="home-section">
          <Reveal>
            <h2>How booking works</h2>
          </Reveal>
          <ol className="how">
            {[
              ['Pick your date and session', 'Morning muhurtham, evening reception or the full day. You only see halls that are free.'],
              ['Hold it for 10 minutes', 'The session is locked for you while you pay, so nobody else can take it in the meantime.'],
              ['Pay the advance, settle the rest at the hall', 'Usually 20–40% online. You get a booking code to show the hall manager.'],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.1}>
                <li>
                  <h3>{t}</h3>
                  <p className="muted">{d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {comingSoon.length > 0 && (
          <section className="home-section">
            <Reveal>
              <h2>Coming to Arangam</h2>
              <div className="soon-row">
                {comingSoon.map((t) => (
                  <div key={t.key} className="soon">
                    <strong>{t.name}</strong>
                    {t.tamilName && <span className="tamil">{t.tamilName}</span>}
                    <div className="small">{t.description}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>
        )}

        <section className="home-section">
          <Reveal>
            <div className="owner-cta">
              <Anim name="kolam" style={{ width: 120, height: 120, flex: 'none' }} stillFrame={45} />
              <div>
                <h2>Own a kalyana mandapam?</h2>
                <p className="muted">
                  List it for free. Set your session prices and advance, block dates you've booked over the phone, and see every booking and balance in one place.
                </p>
                <Link to="/register?as=owner" className="btn">
                  List your hall
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  );
}
