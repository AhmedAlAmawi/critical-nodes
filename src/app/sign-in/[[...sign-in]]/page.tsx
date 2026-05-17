import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-12">
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/select-role" />
    </main>
  );
}
