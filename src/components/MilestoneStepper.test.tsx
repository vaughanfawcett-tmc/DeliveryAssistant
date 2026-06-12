// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MilestoneStepper } from './MilestoneStepper';

describe('MilestoneStepper', () => {
  it('renders all 5 step labels', () => {
    render(<MilestoneStepper currentStage="in_transit" />);
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(screen.getByText('At hub')).toBeInTheDocument();
    expect(screen.getByText('On its way')).toBeInTheDocument();
    expect(screen.getByText('Out for delivery')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('marks steps 1-3 as done (✓) and step 5 as not done when stage is in_transit', () => {
    render(<MilestoneStepper currentStage="in_transit" />);

    // Steps 1 (booked), 2 (at_hub), 3 (in_transit) should show ✓
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(3);

    // Step 5 (Delivered, idx=4) should show its number 5, not ✓
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows the active step label (On its way) for in_transit', () => {
    const { container } = render(<MilestoneStepper currentStage="in_transit" />);

    // The active label should have the accent font-semibold class
    const activeLabel = container.querySelector('.text-accent.font-semibold');
    expect(activeLabel).toBeInTheDocument();
    expect(activeLabel?.textContent).toBe('On its way');
  });

  it('marks all 5 steps as done when stage is delivered', () => {
    render(<MilestoneStepper currentStage="delivered" />);
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(5);
  });

  it('marks only step 1 as done when stage is booked', () => {
    render(<MilestoneStepper currentStage="booked" />);
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(1);
  });

  it('has correct aria-label for accessibility', () => {
    render(<MilestoneStepper currentStage="at_hub" />);
    expect(screen.getByRole('list', { name: 'Delivery progress' })).toBeInTheDocument();
  });
});
