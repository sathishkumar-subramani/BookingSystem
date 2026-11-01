import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { useChangePasswordMutation, useLoginMutation, useRegisterMutation, useUpdateProfileMutation } from '../api/api';
import { errorMessage } from '../api/baseQuery';
import type { AuthResponse } from '../api/types';
import { Anim } from '../components/Anim';
import { ErrorBox, useToast } from '../components/ui';
import { signedIn, userUpdated } from '../store/authSlice';
import { useAppDispatch, useCurrentUser } from '../store';

const homeFor = (r: AuthResponse) => (r.user.role === 'owner' ? '/owner' : r.user.role === 'admin' ? '/admin' : '/halls');
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

const DEMO = [
  ['Customer', 'user@arangam.demo', 'User@1234'],
  ['Hall owner', 'owner@arangam.demo', 'Owner@1234'],
] as const;

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container">
      <motion.div className="auth-wrap" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <Anim name="kolam" style={{ width: 84, height: 84, margin: '0 auto 6px' }} stillFrame={45} />
        <h1 style={{ textAlign: 'center' }}>{title}</h1>
        <div className="panel">{children}</div>
      </motion.div>
    </div>
  );
}

export function Login() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const go = async (e?: FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    try {
      const res = await login(creds ?? { email, password }).unwrap();
      dispatch(signedIn(res));
      navigate(safeNext(sp.get('next')) ?? homeFor(res), { replace: true });
    } catch {
      /* error shown below */
    }
  };

  return (
    <AuthShell title="Sign in">
      <form className="stack" onSubmit={go}>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <ErrorBox message={errorMessage(error)} />}
        <button className="btn block big" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="small" style={{ textAlign: 'center' }}>
          New here? <Link to={`/register${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next')!)}` : ''}`}>Create an account</Link>
        </p>
      </form>
      <div className="demo-logins" style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <span className="muted">Try a demo account:</span>
        <div>
          {DEMO.map(([label, e, p]) => (
            <button key={e} className="btn quiet sm" type="button" disabled={isLoading} onClick={() => go(undefined, { email: e, password: p })}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [register, { isLoading, error }] = useRegisterMutation();
  const [role, setRole] = useState<'user' | 'owner'>(sp.get('as') === 'owner' ? 'owner' : 'user');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', businessName: '', city: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await register({ ...form, role, businessName: role === 'owner' ? form.businessName : undefined, city: role === 'owner' ? form.city : undefined }).unwrap();
      dispatch(signedIn(res));
      navigate(safeNext(sp.get('next')) ?? homeFor(res), { replace: true });
    } catch {
      /* error shown below */
    }
  };

  return (
    <AuthShell title="Create your account">
      <form className="stack" onSubmit={submit}>
        <div className="role-pick" role="group" aria-label="Account type">
          <button type="button" aria-pressed={role === 'user'} onClick={() => setRole('user')}>
            <strong>I want to book</strong>
            <span className="small muted">Find and book halls</span>
          </button>
          <button type="button" aria-pressed={role === 'owner'} onClick={() => setRole('owner')}>
            <strong>I own a hall</strong>
            <span className="small muted">List and manage bookings</span>
          </button>
        </div>
        <label className="field">
          <span>Your name</span>
          <input required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>
            Mobile number <span className="hint">optional, 10 digits</span>
          </span>
          <input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" autoComplete="tel-national" value={form.phone} onChange={set('phone')} />
        </label>
        {role === 'owner' && (
          <motion.div className="field-grid" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <label className="field">
              <span>Business name</span>
              <input value={form.businessName} onChange={set('businessName')} placeholder="e.g. Sri Murugan Mahals" />
            </label>
            <label className="field">
              <span>City</span>
              <input value={form.city} onChange={set('city')} />
            </label>
          </motion.div>
        )}
        <label className="field">
          <span>
            Password <span className="hint">at least 8 characters</span>
          </span>
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </label>
        {role === 'owner' && <p className="small muted">An admin checks new owners before their halls go live. You can add your halls straight away.</p>}
        {error && <ErrorBox message={errorMessage(error)} />}
        <button className="btn block big" disabled={isLoading}>
          {isLoading ? 'Creating…' : 'Create account'}
        </button>
        <p className="small" style={{ textAlign: 'center' }}>
          Already have one? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function Account() {
  const user = useCurrentUser();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [update, { isLoading, error }] = useUpdateProfileMutation();
  const [changePw, { isLoading: pwLoading, error: pwError }] = useChangePasswordMutation();
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', businessName: user?.owner?.businessName ?? '', city: user?.owner?.city ?? '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await update(user.role === 'owner' ? form : { name: form.name, phone: form.phone }).unwrap();
      dispatch(userUpdated(res.user));
      toast('Profile saved.');
    } catch {
      /* shown */
    }
  };
  const savePw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await changePw(pw).unwrap();
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed. Other devices are signed out.');
    } catch {
      /* shown */
    }
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1 style={{ marginTop: 28 }}>Your account</h1>
      <p className="muted">
        {user.email}, signed in as {user.role === 'user' ? 'a customer' : user.role === 'owner' ? 'a hall owner' : 'an admin'}
        {user.owner && <> — owner account {user.owner.status}</>}
      </p>
      <form className="panel stack" onSubmit={save}>
        <h2>Profile</h2>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
        </label>
        <label className="field">
          <span>Mobile number</span>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        {user.role === 'owner' && (
          <div className="field-grid">
            <label className="field">
              <span>Business name</span>
              <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            </label>
            <label className="field">
              <span>City</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
          </div>
        )}
        {error && <ErrorBox message={errorMessage(error)} />}
        <button className="btn" disabled={isLoading}>
          Save profile
        </button>
      </form>
      <form className="panel stack" style={{ marginTop: 16 }} onSubmit={savePw}>
        <h2>Change password</h2>
        <label className="field">
          <span>Current password</span>
          <input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
        </label>
        <label className="field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
        </label>
        {pwError && <ErrorBox message={errorMessage(pwError)} />}
        <button className="btn quiet" disabled={pwLoading}>
          Change password
        </button>
      </form>
    </div>
  );
}
