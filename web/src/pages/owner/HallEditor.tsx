import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { useCatalogQuery, useCreateVenueMutation, useDeleteVenueMutation, useOwnerVenueQuery, useUpdateVenueMutation } from '../../api/api';
import { errorMessage } from '../../api/baseQuery';
import type { Policy, SlotKey, VenueInput } from '../../api/types';
import { HallArt } from '../../components/HallArt';
import { ErrorBox, Loading, useToast } from '../../components/ui';
import { describeRules, paiseToRupees, POLICY_NAMES, rupeesToPaise } from '../../utils/format';

type SlotForm = { key: SlotKey; label: string; enabled: boolean; price: string; start: string; end: string };

const DEFAULT_SLOTS: SlotForm[] = [
  { key: 'MORNING', label: 'Morning muhurtham', enabled: true, price: '', start: '05:00', end: '13:00' },
  { key: 'EVENING', label: 'Evening reception', enabled: true, price: '', start: '16:00', end: '23:00' },
  { key: 'FULL_DAY', label: 'Full day', enabled: true, price: '', start: '05:00', end: '23:00' },
];

const empty = {
  name: '',
  tagline: '',
  description: '',
  line1: '',
  area: '',
  city: '',
  district: 'Chennai',
  pincode: '',
  lat: '',
  lng: '',
  seating: '',
  dining: '',
  rooms: '0',
  parkingCars: '0',
  amenities: [] as string[],
  advancePercent: '25',
  cancellationPolicy: 'moderate' as Policy,
  contactPhone: '',
};

export function HallEditor() {
  const { id } = useParams();
  const editing = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const toast = useToast();
  const { data: catalog } = useCatalogQuery();
  const { data: existing, isLoading } = useOwnerVenueQuery(id!, { skip: !editing });
  const [create, { isLoading: creating, error: createError }] = useCreateVenueMutation();
  const [update, { isLoading: updating, error: updateError }] = useUpdateVenueMutation();
  const [remove] = useDeleteVenueMutation();
  const [f, setF] = useState(empty);
  const [slots, setSlots] = useState<SlotForm[]>(DEFAULT_SLOTS);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const v = existing?.venue;
    if (!v) return;
    setF({
      name: v.name,
      tagline: v.tagline ?? '',
      description: v.description ?? '',
      line1: v.address.line1 ?? '',
      area: v.address.area ?? '',
      city: v.address.city,
      district: v.address.district,
      pincode: v.address.pincode ?? '',
      lat: String(v.location.lat),
      lng: String(v.location.lng),
      seating: String(v.capacity.seating),
      dining: String(v.capacity.dining),
      rooms: String(v.rooms),
      parkingCars: String(v.parkingCars),
      amenities: v.amenities,
      advancePercent: String(v.advancePercent),
      cancellationPolicy: v.cancellationPolicy,
      contactPhone: v.contactPhone ?? '',
    });
    setSlots(
      DEFAULT_SLOTS.map((d) => {
        const s = v.slots.find((x) => x.key === d.key);
        return s ? { ...d, enabled: Boolean(s.enabled), price: String(paiseToRupees(s.price)), start: s.start, end: s.end } : { ...d, enabled: false };
      }),
    );
  }, [existing]);

  if (editing && isLoading) return <Loading />;

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const setSlot = (i: number, patch: Partial<SlotForm>) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const toggleAmenity = (k: string) => setF({ ...f, amenities: f.amenities.includes(k) ? f.amenities.filter((a) => a !== k) : [...f.amenities, k] });

  const pin = () => {
    if (!navigator.geolocation) return toast('Location is not available in this browser.', 'error');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setF((cur) => ({ ...cur, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) }));
        toast('Pinned to where you are standing. Do this at the hall entrance for the best result.');
      },
      () => {
        setLocating(false);
        toast('Location was not shared.', 'error');
      },
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: VenueInput = {
      name: f.name.trim(),
      tagline: f.tagline.trim() || undefined,
      description: f.description.trim() || undefined,
      address: { line1: f.line1.trim() || undefined, area: f.area.trim() || undefined, city: f.city.trim(), district: f.district, pincode: f.pincode.trim() || undefined },
      location: f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : undefined,
      capacity: { seating: Number(f.seating), dining: Number(f.dining || 0) },
      rooms: Number(f.rooms || 0),
      parkingCars: Number(f.parkingCars || 0),
      amenities: f.amenities,
      slots: slots.map((s) => ({ key: s.key, price: rupeesToPaise(Number(s.price || 0)), start: s.start, end: s.end, enabled: s.enabled && Number(s.price) > 0 })),
      advancePercent: Number(f.advancePercent),
      cancellationPolicy: f.cancellationPolicy,
      contactPhone: f.contactPhone.trim() || undefined,
    };
    try {
      if (editing) {
        await update({ id: id!, ...body }).unwrap();
        toast('Saved.');
      } else {
        const res = await create(body).unwrap();
        toast('Hall saved as a draft. Send it for review when ready.');
        navigate(`/owner/halls/${res.venue.id}`, { replace: true });
      }
    } catch {
      /* shown below */
    }
  };

  const err = createError || updateError;
  const v = existing?.venue;
  const policy = catalog?.cancellationPolicies.find((p) => p.key === f.cancellationPolicy);

  return (
    <form className="stack" onSubmit={submit}>
      <div className="spread">
        <h1>{editing ? f.name || 'Edit hall' : 'Add a hall'}</h1>
        {v && <span className={`pill ${v.status}`}>{v.status}</span>}
      </div>
      {v?.status === 'approved' && <p className="notice ok">This hall is live. Changes show to customers as soon as you save.</p>}

      <motion.section className="panel stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h2>About the hall</h2>
        <div className="field-grid">
          <label className="field">
            <span>Hall name</span>
            <input required minLength={3} value={f.name} onChange={set('name')} placeholder="e.g. Sri Lakshmi Kalyana Mandapam" />
          </label>
          <label className="field">
            <span>
              One-line description <span className="hint">shown in search</span>
            </span>
            <input value={f.tagline} onChange={set('tagline')} maxLength={140} placeholder="AC hall with dining for 400" />
          </label>
        </div>
        <label className="field">
          <span>Details</span>
          <textarea value={f.description} onChange={set('description')} maxLength={3000} placeholder="What makes the hall good for weddings: halls, dining, rooms, kitchen, how close to the temple…" />
        </label>
      </motion.section>

      <motion.section className="panel stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h2>Where it is</h2>
        <div className="field-grid">
          <label className="field">
            <span>Door no. and street</span>
            <input value={f.line1} onChange={set('line1')} />
          </label>
          <label className="field">
            <span>Area</span>
            <input value={f.area} onChange={set('area')} placeholder="e.g. Velachery" />
          </label>
          <label className="field">
            <span>Town or city</span>
            <input required value={f.city} onChange={set('city')} />
          </label>
          <label className="field">
            <span>District</span>
            <select value={f.district} onChange={set('district')}>
              {catalog?.districts.map((d) => (
                <option key={d.name}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Pincode</span>
            <input inputMode="numeric" pattern="[1-9][0-9]{5}" value={f.pincode} onChange={set('pincode')} />
          </label>
        </div>
        <div className="row" style={{ alignItems: 'end' }}>
          <label className="field" style={{ width: 140 }}>
            <span>Latitude</span>
            <input value={f.lat} onChange={set('lat')} inputMode="decimal" />
          </label>
          <label className="field" style={{ width: 140 }}>
            <span>Longitude</span>
            <input value={f.lng} onChange={set('lng')} inputMode="decimal" />
          </label>
          <button type="button" className="btn quiet" onClick={pin} disabled={locating}>
            {locating ? 'Locating…' : 'Use my current location'}
          </button>
        </div>
        <p className="small muted">Leave these empty and we'll use the centre of the district until you pin it. A map picker comes with Google Maps later.</p>
      </motion.section>

      <motion.section className="panel stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2>Size and facilities</h2>
        <div className="field-grid">
          <label className="field">
            <span>Seats in the hall</span>
            <input required type="number" min={10} value={f.seating} onChange={set('seating')} />
          </label>
          <label className="field">
            <span>Dining, per sitting</span>
            <input type="number" min={0} value={f.dining} onChange={set('dining')} />
          </label>
          <label className="field">
            <span>Rooms</span>
            <input type="number" min={0} value={f.rooms} onChange={set('rooms')} />
          </label>
          <label className="field">
            <span>Car parking</span>
            <input type="number" min={0} value={f.parkingCars} onChange={set('parkingCars')} />
          </label>
        </div>
        <div className="chips">
          {catalog?.amenities.map((a) => (
            <button type="button" key={a.key} className="chip" aria-pressed={f.amenities.includes(a.key)} onClick={() => toggleAmenity(a.key)}>
              {a.label}
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section className="panel stack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h2>Sessions and prices</h2>
        <div className="slot-editor">
          {slots.map((s, i) => (
            <div key={s.key} className="slot-line" style={{ opacity: s.enabled ? 1 : 0.6 }}>
              <label className="check">
                <input type="checkbox" checked={s.enabled} onChange={(e) => setSlot(i, { enabled: e.target.checked })} />
                <b>{s.label}</b>
              </label>
              <label className="field">
                <span>Price (₹)</span>
                <input type="number" min={0} step={500} value={s.price} disabled={!s.enabled} onChange={(e) => setSlot(i, { price: e.target.value })} required={s.enabled} />
              </label>
              <label className="field">
                <span>From</span>
                <input type="time" value={s.start} disabled={!s.enabled} onChange={(e) => setSlot(i, { start: e.target.value })} />
              </label>
              <label className="field">
                <span>To</span>
                <input type="time" value={s.end} disabled={!s.enabled} onChange={(e) => setSlot(i, { end: e.target.value })} />
              </label>
            </div>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Advance to book (%)</span>
            <select value={f.advancePercent} onChange={set('advancePercent')}>
              {[10, 15, 20, 25, 30, 40, 50, 100].map((p) => (
                <option key={p} value={p}>
                  {p}%
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Cancellation policy</span>
            <select value={f.cancellationPolicy} onChange={set('cancellationPolicy')}>
              {(['flexible', 'moderate', 'strict'] as Policy[]).map((p) => (
                <option key={p} value={p}>
                  {POLICY_NAMES[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Phone for customers</span>
            <input type="tel" value={f.contactPhone} onChange={set('contactPhone')} placeholder="Shown after they book" />
          </label>
        </div>
        {policy && <p className="small muted">{describeRules(policy.rules).join('; ')}.</p>}
      </motion.section>

      {err && <ErrorBox message={errorMessage(err)} />}
      <div className="row">
        <button className="btn big" disabled={creating || updating}>
          {creating || updating ? 'Saving…' : editing ? 'Save changes' : 'Save as draft'}
        </button>
        {v && ['draft', 'rejected'].includes(v.status) && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm(`Delete ${v.name}? This cannot be undone.`)) return;
              try {
                await remove(v.id).unwrap();
                navigate('/owner/halls');
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            }}
          >
            Delete
          </button>
        )}
      </div>
      {v && (
        <div style={{ maxWidth: 320, borderRadius: 12, overflow: 'hidden' }} aria-hidden>
          <HallArt seed={v.coverStyle} />
        </div>
      )}
    </form>
  );
}
