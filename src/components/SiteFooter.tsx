import { PoweredBy } from './PoweredBy';

interface Props {
  contactPhone: string;
}

/**
 * Public site footer — brand name + a help phone number, matching the
 * Derbyshire Specialist Aggregates identity.
 */
export function SiteFooter({ contactPhone }: Props) {
  const tel = contactPhone.replace(/\s+/g, '');
  return (
    <footer className="w-full border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 text-center text-xs text-zinc-500">
        <p className="font-medium text-zinc-600">Derbyshire Specialist Aggregates</p>
        <p className="mt-1">
          Delivery tracking · Need help?{' '}
          <a href={`tel:${tel}`} className="text-accent hover:underline">
            {contactPhone}
          </a>
        </p>
        <div className="mt-3 flex justify-center">
          <PoweredBy />
        </div>
      </div>
    </footer>
  );
}
