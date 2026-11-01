import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useCatalogQuery, useLogoutMutation } from '../api/api';
import { loadSession } from '../api/session';
import { signedOut } from '../store/authSlice';
import { useAppDispatch, useCurrentUser } from '../store';

type Theme = 'system' | 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('arangam.theme') as Theme) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('arangam.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const next = () => setTheme((t) => (t === 'system' ? 'dark' : t === 'dark' ? 'light' : 'system'));
  return { theme, next };
}

function NavItem({ to, children, end }: { to: string; children: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} style={{ position: 'relative' }}>
      {({ isActive }) => (
        <>
          <span className={isActive ? 'active' : ''} style={isActive ? { color: 'var(--primary)', fontWeight: 600 } : undefined}>
            {children}
          </span>
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              style={{ position: 'absolute', left: 12, right: 12, bottom: 2, height: 2.5, borderRadius: 2, background: 'var(--zari)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const };
  if (theme === 'dark') return <svg {...common}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>;
  if (theme === 'light')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
    </svg>
  );
}

export function Layout() {
  const user = useCurrentUser();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [logout] = useLogoutMutation();
  const { theme, next } = useTheme();
  const { data: catalog } = useCatalogQuery();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const signOut = async () => {
    const s = loadSession();
    if (s) logout({ refreshToken: s.refreshToken });
    dispatch(signedOut());
    navigate('/');
  };

  return (
    <>
      {catalog?.payments.testMode && (
        <div className="demo-banner">Demo mode: halls are sample data and payments are simulated. No real money moves.</div>
      )}
      <header className="topbar">
        <div className="container">
          <Link to="/" className="brand" aria-label="Arangam home">
            Arangam <span className="tamil">அரங்கம்</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <NavItem to="/halls">Find a hall</NavItem>
            {user?.role === 'user' && <NavItem to="/bookings">My bookings</NavItem>}
            {user?.role === 'owner' && <NavItem to="/owner">Owner console</NavItem>}
            {user?.role === 'admin' && <NavItem to="/admin">Admin</NavItem>}
            {user ? (
              <>
                <span className="hide-sm">
                  <NavItem to="/account">{user.name.split(' ')[0]}</NavItem>
                </span>
                <button className="link hide-sm" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavItem to="/login">Sign in</NavItem>
                <Link to="/register?as=owner" className="btn sm hide-sm" style={{ marginLeft: 6 }}>
                  List your hall
                </Link>
              </>
            )}
            <button className="icon-btn" onClick={next} aria-label={`Colour theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }} aria-hidden>
                  <ThemeIcon theme={theme} />
                </motion.span>
              </AnimatePresence>
            </button>
          </nav>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname.split('/').slice(0, 3).join('/')}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>

      <footer className="site">
        <div className="container spread">
          <span>
            Arangam (<span className="tamil">அரங்கம்</span>), hall booking for Tamil Nadu
          </span>
          <span className="row">
            {user && (
              <button className="btn ghost sm" onClick={signOut}>
                Sign out
              </button>
            )}
            <Link to="/register?as=owner">Own a hall? List it</Link>
          </span>
        </div>
      </footer>
    </>
  );
}
