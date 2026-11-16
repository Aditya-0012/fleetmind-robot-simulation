import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChartColumn,
  GraduationCap,
  Info,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Network,
  Radar,
  ScrollText,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SimControls } from './SimControls';
import { Logo } from './Logo';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/simulation', label: 'Live simulation', icon: Radar },
  { to: '/algorithms', label: 'Algorithms', icon: Network },
  { to: '/performance', label: 'Performance', icon: ChartColumn },
  { to: '/scenarios', label: 'Scenarios', icon: Map },
  { to: '/events', label: 'Event history', icon: ScrollText },
  { to: '/theory', label: 'DAA theory', icon: BookOpen },
  { to: '/viva', label: 'DAA viva', icon: GraduationCap },
  { to: '/about', label: 'About project', icon: Info },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-hull-800 text-ink-100' : 'text-ink-300 hover:bg-hull-850 hover:text-ink-100'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-signal-cyan" />}
              <Icon size={17} className={isActive ? 'text-signal-cyan' : 'text-ink-400 group-hover:text-ink-200'} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserCard() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hull-700 bg-hull-900/70 p-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-signal-violet/40 to-signal-cyan/30 font-display text-sm font-semibold">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-[11px] text-ink-400">{user.role}</p>
      </div>
      <button className="rounded-md p-1.5 text-ink-400 hover:bg-hull-800 hover:text-signal-red" onClick={logout} title="Sign out" aria-label="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hull-700/70 bg-hull-950/80 px-3 py-4 backdrop-blur lg:flex">
        <div className="px-2 pb-5">
          <Logo />
        </div>
        <NavItems />
        <div className="mt-auto">
          <UserCard />
        </div>
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-hull-950/80" onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-hull-700 bg-hull-950 px-3 py-4"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <div className="flex items-center justify-between px-2 pb-5">
                <Logo />
                <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="text-ink-400">
                  <X size={20} />
                </button>
              </div>
              <NavItems onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto">
                <UserCard />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-hull-700/70 bg-hull-950/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
            <button className="rounded-md p-1.5 text-ink-300 hover:bg-hull-800 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <SimControls />
          </div>
        </header>
        <main className="flex-1 px-4 py-5 lg:px-6">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
