/**
 * Public landing. Signed-in users are routed to their role's portal:
 *   faculty → /faculty   student → /studio   no-role → /select-role
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const { userId } = await auth();
  if (userId) {
    const u = await currentUser();
    const role = u?.publicMetadata?.role as "faculty" | "student" | undefined;
    if (!role) redirect("/select-role");
    redirect(role === "faculty" ? "/faculty" : "/studio");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-4xl sm:text-5xl font-serif tracking-tight">
          Critical Nodes
        </h1>
        <p className="text-stone-600 text-lg leading-relaxed">
          The entire lifecycle of design for the student — from framing the
          problem to producing the AI-mediated visualization, grounded in your
          faculty&rsquo;s own academic material.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/sign-in"
            className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 hover:border-stone-500"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
          >
            Get started
          </Link>
        </div>
      </div>
    </main>
  );
}
