import { listDrivers } from '@/lib/repositories/drivers-repo';
import { DriverList } from '@/components/admin/DriverList';

export default async function DriversPage() {
  const drivers = await listDrivers();

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Drivers</h1>
      <DriverList drivers={drivers} />
    </div>
  );
}
