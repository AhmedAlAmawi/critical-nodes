import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-12">
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/select-role" />
    </main>
  );
}
