import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import App from '../../src/App';
import { localAuthService, AuthError, DEMO_EMAIL, DEMO_PASSWORD } from '../../src/services/authService';

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class RO { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', RO);
if (!window.matchMedia) {
  // @ts-expect-error minimal stub for jsdom
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe('Auth service', () => {
  it('hashes passwords, rejects duplicates and wrong passwords', async () => {
    const u = await localAuthService.register({ name: 'Asha', email: 'Asha@Lab.dev', password: 'robots123' });
    expect(u.email).toBe('asha@lab.dev');
    const raw = localStorage.getItem('fleetmind.users.v1')!;
    expect(raw).not.toContain('robots123');
    await expect(localAuthService.register({ name: 'X', email: 'asha@lab.dev', password: 'robots123' })).rejects.toBeInstanceOf(AuthError);
    localAuthService.logout();
    expect(localAuthService.currentUser()).toBeNull();
    await expect(localAuthService.login('asha@lab.dev', 'wrongpass1')).rejects.toThrow(/incorrect/);
    const back = await localAuthService.login('ASHA@lab.dev', 'robots123');
    expect(back.name).toBe('Asha');
    expect(localAuthService.currentUser()?.id).toBe(u.id);
  });

  it('validates weak passwords', async () => {
    await expect(localAuthService.register({ name: 'A', email: 'a@b.co', password: 'short' })).rejects.toThrow(/8 characters/);
    await expect(localAuthService.register({ name: 'A', email: 'a@b.co', password: 'onlyletters' })).rejects.toThrow(/letters and numbers/);
  });
});

describe('App routing and pages', () => {
  it('redirects signed-out users to the login page', async () => {
    renderAt('/performance');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs in with the demo account and shows live dashboard metrics', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await waitFor(() => expect(screen.getByText('Fill in demo credentials')).toBeEnabled());
    await user.click(screen.getByText('Fill in demo credentials'));
    expect(screen.getByLabelText('Email')).toHaveValue(DEMO_EMAIL);
    expect(screen.getByLabelText('Password')).toHaveValue(DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByRole('heading', { name: 'Fleet overview' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('4 of 4 operational')).toBeInTheDocument();
    expect(screen.getByText('0 of 8 completed')).toBeInTheDocument();

    // single-step the engine from the global controls → metrics update from real state
    await user.click(screen.getByRole('button', { name: 'Single step' }));
    expect(screen.getByText('00:01')).toBeInTheDocument();

    // fail the busiest robot → dashboard reflects it
    await user.click(screen.getByRole('button', { name: /fail busiest robot/i }));
    expect(await screen.findByText('3 of 4 operational')).toBeInTheDocument();
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0);
  }, 20000);

  it('registers a new account and lands on the dashboard', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Full name'), 'Ravi Kumar');
    await user.type(screen.getByLabelText('Email'), 'ravi@college.edu');
    await user.type(screen.getByLabelText('Password'), 'secure123');
    await user.type(screen.getByLabelText('Confirm password'), 'secure123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/Welcome back, Ravi/, {}, { timeout: 5000 })).toBeInTheDocument();
  }, 20000);

  it('renders the viva page with at least 40 questions', async () => {
    await localAuthService.register({ name: 'Tester', email: 't@t.dev', password: 'tester123' });
    renderAt('/viva');
    const list = await screen.findByRole('list', {}, { timeout: 5000 }).catch(() => null);
    const items = (await screen.findAllByRole('button', { expanded: true })).length;
    expect(items).toBeGreaterThanOrEqual(40);
    void list;
  }, 20000);

  it('event history filters by type', async () => {
    const user = userEvent.setup();
    await localAuthService.register({ name: 'Tester', email: 't2@t.dev', password: 'tester123' });
    renderAt('/events');
    expect(await screen.findByRole('heading', { name: 'Event history' }, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Failure/ }));
    expect(await screen.findByText('No events match these filters')).toBeInTheDocument();
    const table = screen.queryByRole('table');
    if (table) expect(within(table).queryAllByRole('row').length).toBeLessThanOrEqual(1);
  }, 20000);
});
