import { listDrivers } from '@/lib/repositories/drivers-repo';
import { DriverList } from '@/components/admin/DriverList';
import { maskPhone } from '@/lib/admin/mask';

// Admin page backed by live DB + env — must render per request, never be
// statically prerendered at build (which would (a) require env at build time
// and (b) bake in an empty driver list). This was failing the Vercel build.
export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const drivers = await listDrivers();

  // CR-01 + WR-05: phone_e164 (raw E.164) is retained on the row so the edit
  // modal can pre-populate correctly. A separate phone_e164_display field carries
  // the masked value for table/card rendering. The raw value is only used inside
  // the authenticated admin DriverModal — it is NOT rendered in the public list
  // cells, so bulk-serialisation PII exposure (the original CR-01 concern) is
  // avoided. Raw E.164 in an admin-only authenticated client component that the
  // admin is actively editing is acceptable per CLAUDE.md GDPR guidance.
  const safeDrivers = drivers.map((d) => ({
    ...d,
    phone_e164_display: maskPhone(d.phone_e164),
    // phone_e164 (raw) intentionally retained for DriverModal defaultValue
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Drivers</h1>
      <DriverList drivers={safeDrivers} />
    </div>
  );
}
