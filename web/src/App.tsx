import type { ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, RouterProvider, useLocation } from 'react-router';
import type { Role } from './api/types';
import { Layout } from './components/Layout';
import { Empty } from './components/ui';
import { AdminApprovals, AdminBookings, AdminCategories, AdminLayout, AdminOverview, AdminUsers } from './pages/admin/Admin';
import { Account, Login, Register } from './pages/Auth';
import { BookingDetail } from './pages/BookingDetail';
import { Checkout } from './pages/Checkout';
import { Home } from './pages/Home';
import { MyBookings } from './pages/MyBookings';
import { HallEditor } from './pages/owner/HallEditor';
import { OwnerBookings, OwnerCalendar, OwnerHalls, OwnerLayout, OwnerOverview } from './pages/owner/Owner';
import { Search } from './pages/Search';
import { Venue } from './pages/Venue';
import { useCurrentUser } from './store';

function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container">
        <Empty title="This page isn't for your account" action={<Link className="btn" to="/">Go home</Link>} />
      </div>
    );
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="container">
      <Empty title="Page not found" action={<Link className="btn" to="/halls">Find a hall</Link>}>
        The link may be old, or the hall may have been removed.
      </Empty>
    </div>
  );
}

export const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'halls', element: <Search /> },
      { path: 'halls/:slug', element: <Venue /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'account', element: <RequireAuth><Account /></RequireAuth> },
      { path: 'checkout/:id', element: <RequireAuth><Checkout /></RequireAuth> },
      { path: 'bookings', element: <RequireAuth roles={['user', 'owner']}><MyBookings /></RequireAuth> },
      { path: 'bookings/:id', element: <RequireAuth><BookingDetail /></RequireAuth> },
      {
        path: 'owner',
        element: <RequireAuth roles={['owner']}><OwnerLayout /></RequireAuth>,
        children: [
          { index: true, element: <OwnerOverview /> },
          { path: 'halls', element: <OwnerHalls /> },
          { path: 'halls/:id', element: <HallEditor /> },
          { path: 'calendar', element: <OwnerCalendar /> },
          { path: 'bookings', element: <OwnerBookings /> },
        ],
      },
      {
        path: 'admin',
        element: <RequireAuth roles={['admin']}><AdminLayout /></RequireAuth>,
        children: [
          { index: true, element: <AdminOverview /> },
          { path: 'approvals', element: <AdminApprovals /> },
          { path: 'bookings', element: <AdminBookings /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'categories', element: <AdminCategories /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
