/**
 * Clerk auth middleware — gates the (faculty) and (student) route groups.
 *
 * Next.js 16 renamed `middleware` → `proxy` but still ships the legacy
 * `middleware.ts` name with backward compatibility. Clerk's helper
 * `clerkMiddleware` continues to expect this name as of @clerk/nextjs v7.
 *
 * Public paths (sign-in/up, landing, role-select, /api/auth/role) are
 * explicitly allowed; everything else requires auth. Role enforcement happens
 * server-side inside each route group's layout.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/select-role(.*)",
  "/api/auth/role(.*)",
  "/about",
  "/legal",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
