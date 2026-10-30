import { LoginPanel } from "@/components/login-panel";
import { googleAuthConfigured } from "@/lib/auth-options";

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";
  const googleReady = googleAuthConfigured();

  return (
    <main className="login-page">
      <LoginPanel googleReady={googleReady} callbackUrl={callbackUrl} error={params.error} />
    </main>
  );
}
