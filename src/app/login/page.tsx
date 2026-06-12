// No "use client" — Server Component.
// DASHBOARD_PASSWORD is never imported here; the client LoginForm component
// only submits to the server action — secrets never reach the client bundle (T-03-03).
import { LoginForm } from '@/components/admin/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <LoginForm />
    </main>
  );
}
