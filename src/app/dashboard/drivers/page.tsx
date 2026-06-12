import { listDrivers } from '@/lib/repositories/drivers-repo';
import { DriverList } from '@/components/admin/DriverList';
import { maskPhone } from '@/lib/admin/mask';

export default async function DriversPage() {
  const drivers = await listDrivers();

  // CR-01: mask driver phone_e164 at the server boundary — raw E.164 must not
  // appear in the serialised React tree / hydration payload (GDPR, CLAUDE.md).
  const safeDrivers = drivers.map((d) => ({
    ...d,
    phone_e164: maskPhone(d.phone_e164),
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Drivers</h1>
      <DriverList drivers={safeDrivers} />
    </div>
  );
}
