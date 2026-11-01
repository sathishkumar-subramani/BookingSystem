import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useCatalogQuery, useSearchVenuesQuery } from '../api/api';
import { errorMessage } from '../api/baseQuery';
import type { SearchParams, SlotKey } from '../api/types';
import { HallRow } from '../components/HallRow';
import { Empty, ErrorBox, Loading, stagger } from '../components/ui';
import { addDaysISO, longDate, todayISO } from '../utils/format';

const PRICE_STEPS = [50_000, 1_00_000, 1_50_000, 2_00_000, 3_00_000, 5_00_000];
const SHOWN_AMENITIES = ['ac', 'parking', 'dining', 'rooms', 'in-house-catering', 'lift', 'generator', 'wheelchair'];

export function Search() {
  const [sp, setSp] = useSearchParams();
  const { data: catalog } = useCatalogQuery();

  const params: SearchParams = useMemo(() => {
    const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
    return {
      district: sp.get('district') || undefined,
      q: sp.get('q') || undefined,
      date: sp.get('date') || undefined,
      slot: (sp.get('slot') as SlotKey) || undefined,
      guests: num('guests'),
      maxPrice: num('maxPrice'),
      amenities: sp.get('amenities') || undefined,
      lat: num('lat'),
      lng: num('lng'),
      radiusKm: num('radiusKm'),
      sort: sp.get('sort') || undefined,
      page: num('page') ?? 1,
    };
  }, [sp]);

  const { data, isFetching, error } = useSearchVenuesQuery(params);

  const set = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setSp(next, { replace: k !== 'page' });
  };
  const amenities = params.amenities ? params.amenities.split(',') : [];
  const toggleAmenity = (a: string) => set('amenities', (amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a]).join(',') || undefined);
  const nearMe = params.lat != null && params.lng != null;

  const title = nearMe
    ? 'Halls near you'
    : params.district
      ? `Halls in ${params.district}`
      : params.q
        ? `Halls matching “${params.q}”`
        : 'All marriage halls';

  return (
    <div className="container">
      <div className="search-layout">
        <aside className="filters" aria-label="Filters">
          <label className="field">
            <span>District</span>
            <select
              value={nearMe ? '__near' : (params.district ?? '')}
              onChange={(e) => {
                const next = new URLSearchParams(sp);
                ['lat', 'lng', 'radiusKm', 'page'].forEach((k) => next.delete(k));
                if (e.target.value) next.set('district', e.target.value);
                else next.delete('district');
                setSp(next, { replace: true });
              }}
            >
              {nearMe && <option value="__near">Near my location</option>}
              <option value="">All of Tamil Nadu</option>
              {catalog?.districts.map((d) => (
                <option key={d.name}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Hall name or area</span>
            <input type="search" defaultValue={params.q} placeholder="e.g. Velachery" onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value.trim() || undefined)} onBlur={(e) => set('q', e.target.value.trim() || undefined)} />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={params.date ?? ''} min={addDaysISO(todayISO(), 1)} onChange={(e) => set('date', e.target.value || undefined)} />
          </label>
          <div>
            <h3>Session</h3>
            <div className="chips" role="group" aria-label="Session">
              {(
                [
                  [undefined, 'Any'],
                  ['MORNING', 'Morning'],
                  ['EVENING', 'Evening'],
                  ['FULL_DAY', 'Full day'],
                ] as const
              ).map(([k, label]) => (
                <button key={label} className="chip" aria-pressed={params.slot === k} onClick={() => set('slot', k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Guests</span>
            <input type="number" min={10} step={50} defaultValue={params.guests} placeholder="e.g. 500" onBlur={(e) => set('guests', e.target.value || undefined)} onKeyDown={(e) => e.key === 'Enter' && set('guests', (e.target as HTMLInputElement).value || undefined)} />
          </label>
          <label className="field">
            <span>Budget per session</span>
            <select value={params.maxPrice ?? ''} onChange={(e) => set('maxPrice', e.target.value || undefined)}>
              <option value="">Any budget</option>
              {PRICE_STEPS.map((r) => (
                <option key={r} value={r * 100}>
                  Up to ₹{r.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </label>
          <div>
            <h3>Must have</h3>
            <div className="chips">
              {catalog?.amenities
                .filter((a) => SHOWN_AMENITIES.includes(a.key))
                .map((a) => (
                  <button key={a.key} className="chip" aria-pressed={amenities.includes(a.key)} onClick={() => toggleAmenity(a.key)}>
                    {a.label}
                  </button>
                ))}
            </div>
          </div>
        </aside>

        <section aria-live="polite">
          <div className="results-head">
            <div>
              <h1>{title}</h1>
              <div className="small muted">
                {data ? `${data.total.toLocaleString('en-IN')} found` : ' '}
                {params.date && <> that are free on {longDate(params.date)}</>}
                {params.guests && <> for {params.guests.toLocaleString('en-IN')} guests</>}
              </div>
            </div>
            <label className="row small">
              Sort
              <select className="input" style={{ minHeight: 36, width: 'auto' }} value={params.sort ?? (nearMe ? 'distance' : 'price_asc')} onChange={(e) => set('sort', e.target.value)}>
                {nearMe && <option value="distance">Nearest first</option>}
                <option value="price_asc">Price, low to high</option>
                <option value="price_desc">Price, high to low</option>
                <option value="capacity_desc">Biggest first</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>

          {error && <ErrorBox message={errorMessage(error)} />}
          {!data && isFetching && <Loading text="Finding halls… (the server may take a moment to wake up)" />}
          {data && data.items.length === 0 && (
            <Empty title="No hall matches all of that" action={<button className="btn quiet" onClick={() => setSp(new URLSearchParams(params.date ? { date: params.date } : {}))}>Clear filters</button>}>
              Try another date or session, a nearby district, or fewer must-haves.
            </Empty>
          )}
          <AnimatePresence mode="wait">
            {data && data.items.length > 0 && (
              <motion.div key={sp.toString()} variants={stagger.container} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.1 } }} style={{ opacity: isFetching ? 0.6 : 1 }}>
                {data.items.map((v) => (
                  <HallRow key={v.id} venue={v} date={params.date} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {data && data.pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button className="btn quiet sm" disabled={data.page <= 1} onClick={() => set('page', String(data.page - 1))}>
                Previous
              </button>
              <span className="small muted">
                Page {data.page} of {data.pages}
              </span>
              <button className="btn quiet sm" disabled={data.page >= data.pages} onClick={() => set('page', String(data.page + 1))}>
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
