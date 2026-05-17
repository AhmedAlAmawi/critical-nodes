/**
 * Manual route smoke check — pings public health endpoints to make sure the
 * Next.js build is reachable. Intended for local + CI use.
 *
 * Usage:
 *   APP_URL=http://localhost:3000 tsx scripts/smoke-routes.ts
 *
 * NOTE: auth-gated routes (every /faculty/* and /studio/*) return a redirect
 * to /sign-in for unauthenticated requests. We treat 200, 307 (redirect), and
 * 401 as "route reachable"; only 404 / 5xx are smoke failures.
 */

import "dotenv/config";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const ROUTES: Array<{ method: "GET" | "POST"; path: string; label: string }> = [
  { method: "GET", path: "/", label: "landing" },
  { method: "GET", path: "/sign-in", label: "sign-in" },
  { method: "GET", path: "/sign-up", label: "sign-up" },
  { method: "GET", path: "/select-role", label: "select-role" },
  { method: "GET", path: "/faculty", label: "faculty home (auth)" },
  { method: "GET", path: "/studio", label: "studio home (auth)" },
  { method: "POST", path: "/api/auth/role", label: "auth/role (unauth)" },
  { method: "POST", path: "/api/mentor", label: "mentor (unauth)" },
  { method: "POST", path: "/api/evaluate", label: "evaluate (unauth)" },
  { method: "POST", path: "/api/audit", label: "audit (unauth)" },
];

async function main() {
  let pass = 0;
  let fail = 0;
  for (const r of ROUTES) {
    try {
      const res = await fetch(`${APP_URL}${r.path}`, {
        method: r.method,
        redirect: "manual",
        headers: r.method === "POST" ? { "Content-Type": "application/json" } : {},
        body: r.method === "POST" ? "{}" : undefined,
      });
      const ok = [200, 301, 302, 307, 308, 401, 403, 400].includes(res.status);
      console.log(`${ok ? "PASS" : "FAIL"} ${r.method.padEnd(4)} ${r.path}  → ${res.status}  ${r.label}`);
      if (ok) pass++;
      else fail++;
    } catch (err) {
      console.log(`FAIL ${r.method.padEnd(4)} ${r.path}  → ${(err as Error).message}`);
      fail++;
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
