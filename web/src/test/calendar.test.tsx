import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AvailabilityDay } from '../api/types';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';

const day = (date: string, morning: AvailabilityDay['units']['MORNING'], evening: AvailabilityDay['units']['EVENING'], bookable = true): AvailabilityDay => ({
  date,
  bookable,
  adjustmentPercent: 0,
  specialNote: null,
  units: { MORNING: morning, EVENING: evening },
  slots: [
    { key: 'MORNING', available: bookable && morning === 'free', price: 100 },
    { key: 'EVENING', available: bookable && evening === 'free', price: 100 },
  ],
});

describe('AvailabilityCalendar', () => {
  it('lets you pick a day with a free session and not a fully booked one', async () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityCalendar
        month="2030-03"
        days={[day('2030-03-01', 'free', 'taken'), day('2030-03-02', 'taken', 'taken')]}
        onSelect={onSelect}
        onMonth={() => {}}
      />,
    );
    const free = screen.getByRole('button', { name: /2030-03-01/ });
    const full = screen.getByRole('button', { name: /2030-03-02/ });
    expect(full).toBeDisabled();
    await userEvent.click(free);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ date: '2030-03-01' }));
  });

  it('asks for the next month', async () => {
    const onMonth = vi.fn();
    render(<AvailabilityCalendar month="2030-12" days={[]} onSelect={() => {}} onMonth={onMonth} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onMonth).toHaveBeenCalledWith('2031-01');
  });
});
