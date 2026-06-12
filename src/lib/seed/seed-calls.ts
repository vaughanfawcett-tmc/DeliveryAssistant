/**
 * seed-calls.ts — Dev-only seed script for the admin dashboard.
 *
 * NEVER imported in app code. Run via:
 *   npx tsx src/lib/seed/seed-calls.ts
 * or (once Plan 03-01 registers it):
 *   npm run seed
 *
 * Guards:
 * - Aborts immediately unless PALLEX_MOCK=true (T-03-08)
 * - Idempotent: skips if SEED- rows already exist
 *
 * Produces data for every dashboard surface:
 * - ~25 inbound customer calls spanning 30 days (all outcomes)
 * - ~5 rows with structured transcript JSON (Phase 4 compatible)
 * - ~4 linked outbound driver calls (2 parent customer calls)
 * - ~5 driver rows for the Drivers page
 */

import 'dotenv/config';

// ---------------------------------------------------------------------------
// PALLEX_MOCK guard (T-03-08 — never run against production)
// ---------------------------------------------------------------------------

if (process.env.PALLEX_MOCK !== 'true') {
  console.error('ERROR: Seed script only runs when PALLEX_MOCK=true. Aborting.');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

// Use service-role client directly (seed script is standalone, not app code)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) must be set.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ---------------------------------------------------------------------------
// Idempotency check — skip if SEED- rows already present
// ---------------------------------------------------------------------------

const { data: existing } = await supabase
  .from('calls')
  .select('id')
  .like('tracking_ref', 'SEED-%')
  .limit(1);

if (existing && existing.length > 0) {
  console.log('Seed data already present. Delete SEED- rows to re-seed.');
  process.exit(0);
}

console.log('Seeding calls and drivers...');

// ---------------------------------------------------------------------------
// Helper: generate a timestamp N days + H hours ago
// ---------------------------------------------------------------------------

function daysAgo(days: number, hoursOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hoursOffset);
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  return d.toISOString();
}

function randomDuration(): number {
  // 30s to 8min in ms
  return Math.floor(Math.random() * 450_000) + 30_000;
}

function randomPhone(): string {
  const digits = Math.floor(Math.random() * 90_000_000) + 10_000_000;
  return `+4479${digits}`;
}

// ---------------------------------------------------------------------------
// Structured transcript samples (Phase 4 compatible JSON array)
// ---------------------------------------------------------------------------

const TRANSCRIPTS = [
  JSON.stringify([
    { speaker: 'agent', text: 'Thank you for calling Derby Aggs delivery tracking. How can I help?', ts: 0 },
    { speaker: 'customer', text: "Hi, I'm trying to track my delivery, number PA123456.", ts: 4 },
    { speaker: 'agent', text: 'Of course. Can you confirm your delivery postcode?', ts: 8 },
    { speaker: 'customer', text: 'DE1 1AA', ts: 11 },
    { speaker: 'agent', text: 'Your delivery is out for delivery today and expected between 10am and 2pm.', ts: 14 },
    { speaker: 'customer', text: 'Great, thank you!', ts: 19 },
  ]),
  JSON.stringify([
    { speaker: 'agent', text: "Derby Aggs delivery tracking. What's your tracking reference?", ts: 0 },
    { speaker: 'customer', text: 'It is PA987654.', ts: 3 },
    { speaker: 'agent', text: 'And your delivery postcode please?', ts: 6 },
    { speaker: 'customer', text: 'NG1 5AB', ts: 9 },
    { speaker: 'agent', text: 'Your consignment has been delivered and signed for at 14:32 today.', ts: 12 },
    { speaker: 'customer', text: 'Perfect, many thanks.', ts: 17 },
  ]),
  JSON.stringify([
    { speaker: 'agent', text: 'Hello, Derby Aggs tracking. How can I help you today?', ts: 0 },
    { speaker: 'customer', text: 'My delivery was due yesterday but nothing has arrived.', ts: 4 },
    { speaker: 'agent', text: "I'm sorry to hear that. Can you give me your tracking number?", ts: 8 },
    { speaker: 'customer', text: 'PA555444.', ts: 11 },
    { speaker: 'agent', text: 'Your postcode please?', ts: 13 },
    { speaker: 'customer', text: 'B1 1BB', ts: 15 },
    { speaker: 'agent', text: 'I can see your delivery is at the depot and has been rescheduled for tomorrow. A driver will attempt delivery before noon.', ts: 18 },
  ]),
  JSON.stringify([
    { speaker: 'agent', text: 'Derby Aggs delivery line. How can I help?', ts: 0 },
    { speaker: 'customer', text: 'Can you tell me if my parcel has left the depot?', ts: 3 },
    { speaker: 'agent', text: 'Sure, what is your tracking reference?', ts: 6 },
    { speaker: 'customer', text: 'PA112233.', ts: 8 },
    { speaker: 'agent', text: 'Postcode?', ts: 10 },
    { speaker: 'customer', text: 'M1 3DE', ts: 12 },
    { speaker: 'agent', text: 'Yes, your consignment left the Derby Aggs depot at 7:45 this morning and is currently in transit.', ts: 15 },
  ]),
  JSON.stringify([
    { speaker: 'agent', text: 'Thank you for calling. What is your tracking number?', ts: 0 },
    { speaker: 'customer', text: 'Um, I think it is PA778899.', ts: 4 },
    { speaker: 'agent', text: 'And your delivery postcode?', ts: 7 },
    { speaker: 'customer', text: 'LS1 4GH', ts: 9 },
    { speaker: 'agent', text: "I'm connecting you to a driver who can give you a live update.", ts: 12 },
  ]),
];

// ---------------------------------------------------------------------------
// Build 25 customer call rows
// Distribution: ~8 in last 24h, ~15 in last 7d, 25 total in 30d
// Outcomes: resolved (10), escalated (6), no_data (5), failed (4)
// ---------------------------------------------------------------------------

type CallInsert = {
  platform_call_id: string;
  from_number: string | null;
  direction: 'inbound' | 'outbound';
  call_type: 'customer' | 'driver';
  start_at: string;
  end_at: string | null;
  duration_ms: number | null;
  outcome: 'resolved' | 'escalated' | 'no_data' | 'failed' | null;
  tracking_ref: string | null;
  transcript: string | null;
  disconnection_reason: string | null;
  parent_call_id: string | null;
};

const customerCalls: CallInsert[] = [
  // Last 24h — 8 calls
  { platform_call_id: 'el-seed-001', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 2), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-001', transcript: TRANSCRIPTS[0], disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-002', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 3), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-002', transcript: TRANSCRIPTS[1], disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-003', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 5), end_at: null, duration_ms: randomDuration(), outcome: 'escalated', tracking_ref: 'SEED-003', transcript: TRANSCRIPTS[4], disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-004', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 6), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-004', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-005', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 8), end_at: null, duration_ms: null, outcome: 'no_data', tracking_ref: null, transcript: null, disconnection_reason: 'customer_hangup', parent_call_id: null },
  { platform_call_id: 'el-seed-006', from_number: null, direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 10), end_at: null, duration_ms: randomDuration(), outcome: 'failed', tracking_ref: 'SEED-006', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-007', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 14), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-007', transcript: TRANSCRIPTS[2], disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-008', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(0, 20), end_at: null, duration_ms: randomDuration(), outcome: 'escalated', tracking_ref: 'SEED-008', transcript: null, disconnection_reason: null, parent_call_id: null },

  // Days 1-7 — 7 more calls (15 total in 7d)
  { platform_call_id: 'el-seed-009', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(1), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-009', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-010', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(2), end_at: null, duration_ms: randomDuration(), outcome: 'escalated', tracking_ref: 'SEED-010', transcript: TRANSCRIPTS[3], disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-011', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(3), end_at: null, duration_ms: null, outcome: 'no_data', tracking_ref: null, transcript: null, disconnection_reason: 'customer_hangup', parent_call_id: null },
  { platform_call_id: 'el-seed-012', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(4), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-012', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-013', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(5), end_at: null, duration_ms: randomDuration(), outcome: 'failed', tracking_ref: 'SEED-013', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-014', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(6), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-014', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-015', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(7), end_at: null, duration_ms: randomDuration(), outcome: 'escalated', tracking_ref: 'SEED-015', transcript: null, disconnection_reason: null, parent_call_id: null },

  // Days 8-29 — 10 more calls (25 total in 30d)
  { platform_call_id: 'el-seed-016', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(9), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-016', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-017', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(11), end_at: null, duration_ms: null, outcome: 'no_data', tracking_ref: null, transcript: null, disconnection_reason: 'silence_timeout', parent_call_id: null },
  { platform_call_id: 'el-seed-018', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(13), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-018', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-019', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(15), end_at: null, duration_ms: randomDuration(), outcome: 'escalated', tracking_ref: 'SEED-019', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-020', from_number: null, direction: 'inbound', call_type: 'customer', start_at: daysAgo(17), end_at: null, duration_ms: randomDuration(), outcome: 'failed', tracking_ref: 'SEED-020', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-021', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(19), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-021', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-022', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(21), end_at: null, duration_ms: null, outcome: 'no_data', tracking_ref: null, transcript: null, disconnection_reason: 'customer_hangup', parent_call_id: null },
  { platform_call_id: 'el-seed-023', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(23), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-023', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-024', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(26), end_at: null, duration_ms: randomDuration(), outcome: 'failed', tracking_ref: 'SEED-024', transcript: null, disconnection_reason: null, parent_call_id: null },
  { platform_call_id: 'el-seed-025', from_number: randomPhone(), direction: 'inbound', call_type: 'customer', start_at: daysAgo(28), end_at: null, duration_ms: randomDuration(), outcome: 'resolved', tracking_ref: 'SEED-025', transcript: null, disconnection_reason: null, parent_call_id: null },
];

// Insert customer calls
const { data: insertedCalls, error: callsError } = await supabase
  .from('calls')
  .insert(customerCalls)
  .select('id, platform_call_id');

if (callsError) {
  console.error('ERROR inserting customer calls:', callsError.message);
  process.exit(1);
}

console.log(`Inserted ${insertedCalls?.length ?? 0} customer calls.`);

// ---------------------------------------------------------------------------
// Linked outbound driver calls (for SEED-003 and SEED-008 parent calls)
// ---------------------------------------------------------------------------

// Find the ids of the 2 escalated parent calls we want to link driver calls to
const parentPlatformIds = ['el-seed-003', 'el-seed-008'];
const parentCalls = (insertedCalls ?? []).filter((c: { id: string; platform_call_id: string }) =>
  parentPlatformIds.includes(c.platform_call_id),
);

const driverCalls: CallInsert[] = [];

for (const parent of parentCalls) {
  // 2 driver calls per parent
  driverCalls.push(
    {
      platform_call_id: `el-seed-drv-${parent.platform_call_id}-a`,
      from_number: null,
      direction: 'outbound',
      call_type: 'driver',
      start_at: daysAgo(0, 3),
      end_at: null,
      duration_ms: randomDuration(),
      outcome: 'resolved',
      tracking_ref: null,
      transcript: JSON.stringify([
        { speaker: 'agent', text: 'Hi, this is the Derby Aggs tracking system calling. Can you give a live update on delivery PA555?', ts: 0 },
        { speaker: 'driver', text: "I'm about 20 minutes away, should be with the customer by 2pm.", ts: 5 },
      ]),
      disconnection_reason: null,
      parent_call_id: parent.id,
    },
    {
      platform_call_id: `el-seed-drv-${parent.platform_call_id}-b`,
      from_number: null,
      direction: 'outbound',
      call_type: 'driver',
      start_at: daysAgo(0, 2),
      end_at: null,
      duration_ms: null,
      outcome: 'no_data',
      tracking_ref: null,
      transcript: null,
      disconnection_reason: 'no_answer',
      parent_call_id: parent.id,
    },
  );
}

if (driverCalls.length > 0) {
  const { data: insertedDriverCalls, error: dcError } = await supabase
    .from('calls')
    .insert(driverCalls)
    .select('id');

  if (dcError) {
    console.warn('WARNING: Failed to insert driver calls:', dcError.message);
  } else {
    console.log(`Inserted ${insertedDriverCalls?.length ?? 0} driver call rows.`);
  }
}

// ---------------------------------------------------------------------------
// Driver rows for the Drivers page
// ---------------------------------------------------------------------------

const driverRows = [
  { name: 'James Thornton', phone_e164: '+447911100001', active: true },
  { name: 'Maria Santos',   phone_e164: '+447911100002', active: true },
  { name: 'Paul Okafor',    phone_e164: '+447911100003', active: true },
  { name: 'Susan Patel',    phone_e164: '+447911100004', active: true },
  { name: 'Liam Hughes',    phone_e164: '+447911100005', active: false }, // inactive — D-10 soft deactivate test
];

const { data: insertedDrivers, error: driversError } = await supabase
  .from('drivers')
  .insert(driverRows)
  .select('id');

if (driversError) {
  console.warn('WARNING: Failed to insert drivers:', driversError.message);
} else {
  console.log(`Inserted ${insertedDrivers?.length ?? 0} driver rows.`);
}

console.log('Seed complete.');
