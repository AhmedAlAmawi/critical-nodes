#!/usr/bin/env node
// Count users created per day from 2026-04-10 -> today,
// filtered to a list of email domains.
//
// Usage:
//   DATABASE_URL=postgres://user:pass@host:5432/db node scripts/users-by-day.mjs
//
// Requires: npm i pg
// If your users live somewhere else (Mongo, Firebase, Clerk, an API),
// replace `fetchUsers` with the appropriate fetcher.

import pg from "pg";

const DOMAINS = [
  "telmailco.com",
  "etherealcomms.com",
  "apexillion.com",
  "chronosecure.com",
  "ephemeremail.com",
  "ironcladinbox.com",
  "omnicomflux.com",
  "synapsecoms.com",
  "transientia.com",
  "transvoxel.com",
  "ephemeralis.com",
  "ephemeronix.com",
  "fluxghost.com",
  "fluxhush.com",
  "fuguecastle.com",
  "ghostfluxnode.com",
  "glitchpost.com",
  "pulsarveil.com",
  "pulsevoidhub.com",
  "transiencelink.com",
];

const START = "2026-04-10";

async function fetchCounts() {
  const { Client } = pg;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Single round-trip aggregation. Adjust table/column names if needed:
  //   table: users    column: created_at    column: email
  const sql = `
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
           COUNT(*)::int                          AS count
    FROM users
    WHERE created_at >= $1::date
      AND created_at <  (CURRENT_DATE + INTERVAL '1 day')
      AND LOWER(email) ~ $2
    GROUP BY day
    ORDER BY day;
  `;
  const regex = `(${DOMAINS.map((d) => d.replace(/\./g, "\\.")).join("|")})`;
  const { rows } = await client.query(sql, [START, regex]);
  await client.end();
  return rows;
}

function fmt(rows) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  console.log("day         users_created");
  console.log("---------- --------------");
  for (const r of rows) {
    const day = new Date(r.day).toISOString().slice(0, 10);
    console.log(`${day}  ${String(r.count).padStart(13)}`);
  }
  console.log("---------- --------------");
  console.log(`TOTAL       ${String(total).padStart(13)}`);
}

fetchCounts()
  .then(fmt)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
