import type { NexusConsignment } from '../types/consignment';

/**
 * PA-12345 — In Transit, confirmed ETA window.
 * Used as the canonical "happy path" fixture.
 */
export const FOUND_IN_TRANSIT: NexusConsignment = {
  consignmentNumber: 'PA-12345',
  consignmentID: 10001,
  customerReference: 'CUST-001',
  status: { id: 3, name: 'In Transit' },
  estimatedDelDate: '2026-06-18',
  estimatedDelTime: '10:00',
  startWindow: '09:00',
  endWindow: '11:00',
  delAddressLine1: '1 Industrial Estate',
  delAddressTown: 'Derby',
  delAddressPostcode: 'DE1 1AA',
  colDate: '2026-06-17',
  delDateTime: null,
  routeDetails: [
    {
      type: 'Collection',
      routeDate: '2026-06-17',
      regNo: 'AB21 XYZ',
      round: 'R01',
      status: 'Collected',
      palletCount: 2,
    },
  ],
};

/**
 * PA-67890 — Delivered, delivery timestamp present.
 */
export const FOUND_DELIVERED: NexusConsignment = {
  consignmentNumber: 'PA-67890',
  consignmentID: 10002,
  customerReference: 'CUST-002',
  status: { id: 5, name: 'Delivered' },
  estimatedDelDate: '2026-06-17',
  estimatedDelTime: '09:30',
  startWindow: '08:00',
  endWindow: '12:00',
  delAddressLine1: '42 Castle Donington Lane',
  delAddressTown: 'Castle Donington',
  delAddressPostcode: 'DE74 2SA',
  colDate: '2026-06-16',
  delDateTime: '2026-06-17T09:27:00Z',
  routeDetails: [
    {
      type: 'Delivery',
      routeDate: '2026-06-17',
      regNo: 'CD22 ABC',
      round: 'R03',
      status: 'Delivered',
      palletCount: 1,
    },
  ],
};

/**
 * PA-99999 — Booked, null ETA.
 * CRITICAL edge case (PITFALLS.md): estimatedDelDate MUST be null so downstream
 * surfaces explicitly handle the absent-ETA path rather than guessing.
 */
export const FOUND_NULL_ETA: NexusConsignment = {
  consignmentNumber: 'PA-99999',
  consignmentID: 10003,
  customerReference: 'CUST-003',
  status: { id: 1, name: 'Booked' },
  estimatedDelDate: null,   // intentionally null — PITFALLS.md null-ETA edge case
  estimatedDelTime: null,
  startWindow: null,
  endWindow: null,
  delAddressLine1: '7 Lace Market Square',
  delAddressTown: 'Nottingham',
  delAddressPostcode: 'NG1 5FS',
  colDate: null,
  delDateTime: null,
  routeDetails: [],
};

/**
 * All known consignments — used by the MSW handler for searchTerm matching.
 */
export const KNOWN_CONSIGNMENTS: NexusConsignment[] = [
  FOUND_IN_TRANSIT,
  FOUND_DELIVERED,
  FOUND_NULL_ETA,
];
