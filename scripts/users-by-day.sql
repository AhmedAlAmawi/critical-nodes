-- Users created per day from 2026-04-10 -> today,
-- where email matches one of the listed domains.
--
-- Tweak `users`, `created_at`, `email` to match your schema.
-- Works on Postgres. For MySQL: replace ::date with DATE(created_at).

WITH target_domains(domain) AS (
  VALUES
    ('telmailco.com'),
    ('etherealcomms.com'),
    ('apexillion.com'),
    ('chronosecure.com'),
    ('ephemeremail.com'),
    ('ironcladinbox.com'),
    ('omnicomflux.com'),
    ('synapsecoms.com'),
    ('transientia.com'),
    ('transvoxel.com'),
    ('ephemeralis.com'),
    ('ephemeronix.com'),
    ('fluxghost.com'),
    ('fluxhush.com'),
    ('fuguecastle.com'),
    ('ghostfluxnode.com'),
    ('glitchpost.com'),
    ('pulsarveil.com'),
    ('pulsevoidhub.com'),
    ('transiencelink.com')
)
SELECT
  (u.created_at AT TIME ZONE 'UTC')::date AS day,
  COUNT(*)                                AS users_created
FROM users u
JOIN target_domains d
  ON LOWER(u.email) LIKE '%@' || d.domain
  OR LOWER(u.email) LIKE '%' || d.domain  -- matches sub-addressed/embedded too
WHERE u.created_at >= '2026-04-10'
  AND u.created_at <  (CURRENT_DATE + INTERVAL '1 day')
GROUP BY day
ORDER BY day;

-- Total across the window:
-- Wrap above as a CTE and SUM(users_created), or run:
SELECT COUNT(*) AS total_users
FROM users u
WHERE u.created_at >= '2026-04-10'
  AND u.created_at <  (CURRENT_DATE + INTERVAL '1 day')
  AND LOWER(u.email) ~ '(telmailco\.com|etherealcomms\.com|apexillion\.com|chronosecure\.com|ephemeremail\.com|ironcladinbox\.com|omnicomflux\.com|synapsecoms\.com|transientia\.com|transvoxel\.com|ephemeralis\.com|ephemeronix\.com|fluxghost\.com|fluxhush\.com|fuguecastle\.com|ghostfluxnode\.com|glitchpost\.com|pulsarveil\.com|pulsevoidhub\.com|transiencelink\.com)';
