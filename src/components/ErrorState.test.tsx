// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';
import type { MatchCandidate } from '@/types/tracking';

const TEST_PHONE = '+44 1234 567890';

describe('ErrorState', () => {
  describe('reason: not_found', () => {
    it('renders the not_found heading', () => {
      render(<ErrorState reason="not_found" contactPhone={TEST_PHONE} />);
      expect(screen.getByText(/We couldn't find that delivery/i)).toBeInTheDocument();
    });

    it('renders a tel: link containing the contact phone number', () => {
      render(<ErrorState reason="not_found" contactPhone={TEST_PHONE} />);
      const link = screen.getByRole('link', { name: /Call us/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', `tel:${TEST_PHONE}`);
    });

    it('renders a Try again link pointing to /', () => {
      render(<ErrorState reason="not_found" contactPhone={TEST_PHONE} />);
      const tryAgain = screen.getByRole('link', { name: /Try again/i });
      expect(tryAgain).toBeInTheDocument();
      expect(tryAgain).toHaveAttribute('href', '/');
    });
  });

  describe('reason: postcode_mismatch', () => {
    it('renders the postcode_mismatch heading', () => {
      render(<ErrorState reason="postcode_mismatch" contactPhone={TEST_PHONE} />);
      expect(screen.getByText(/Postcode doesn't match/i)).toBeInTheDocument();
    });

    it('does NOT render a Call us link', () => {
      render(<ErrorState reason="postcode_mismatch" contactPhone={TEST_PHONE} />);
      expect(screen.queryByRole('link', { name: /Call us/i })).not.toBeInTheDocument();
    });

    it('still renders a Try again link', () => {
      render(<ErrorState reason="postcode_mismatch" contactPhone={TEST_PHONE} />);
      expect(screen.getByRole('link', { name: /Try again/i })).toBeInTheDocument();
    });
  });

  describe('reason: api_error', () => {
    it('renders the api_error heading', () => {
      render(<ErrorState reason="api_error" contactPhone={TEST_PHONE} />);
      expect(screen.getByText(/Service unavailable/i)).toBeInTheDocument();
    });

    it('renders a Call us tel: link', () => {
      render(<ErrorState reason="api_error" contactPhone={TEST_PHONE} />);
      const link = screen.getByRole('link', { name: /Call us/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', `tel:${TEST_PHONE}`);
    });
  });

  describe('reason: multiple_matches with candidates', () => {
    const candidates: MatchCandidate[] = [
      {
        consignmentNumber: 'CON-001',
        delAddressTown: 'Derby',
        plainStatus: 'In transit',
      },
      {
        consignmentNumber: 'CON-002',
        delAddressTown: 'Nottingham',
        plainStatus: 'At hub',
      },
    ];

    it('renders both candidates consignment numbers', () => {
      render(
        <ErrorState
          reason="multiple_matches"
          contactPhone={TEST_PHONE}
          candidates={candidates}
        />,
      );
      expect(screen.getByText('CON-001')).toBeInTheDocument();
      expect(screen.getByText('CON-002')).toBeInTheDocument();
    });

    it('renders delivery towns for each candidate', () => {
      render(
        <ErrorState
          reason="multiple_matches"
          contactPhone={TEST_PHONE}
          candidates={candidates}
        />,
      );
      expect(screen.getByText(/Derby/)).toBeInTheDocument();
      expect(screen.getByText(/Nottingham/)).toBeInTheDocument();
    });

    it('renders plain statuses for each candidate', () => {
      render(
        <ErrorState
          reason="multiple_matches"
          contactPhone={TEST_PHONE}
          candidates={candidates}
        />,
      );
      expect(screen.getByText('In transit')).toBeInTheDocument();
      expect(screen.getByText('At hub')).toBeInTheDocument();
    });

    it('rendered output contains no postcode string', () => {
      const { container } = render(
        <ErrorState
          reason="multiple_matches"
          contactPhone={TEST_PHONE}
          candidates={candidates}
        />,
      );
      // D-10: chooser must never leak postcode
      expect(container.textContent).not.toMatch(/postcode/i);
      expect(container.textContent).not.toMatch(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i);
    });
  });

  it('has role="alert" on the wrapper', () => {
    render(<ErrorState reason="not_found" contactPhone={TEST_PHONE} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
