import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
