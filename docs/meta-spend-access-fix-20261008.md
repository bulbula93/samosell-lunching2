# Meta spend access failure — 2026-10-08

## Evidence and scope

The Production sync state for approved account `948841811174019` recorded
`last_success_at = 2026-10-08T06:21:36.040Z` (10:21 Tbilisi) and
`last_error = meta_authorization_failed`. This was a read-only query.
Vercel has a sensitive Production `META_ADS_ACCESS_TOKEN`; its value cannot be
read back. Expiration is plausible, but the original generic error does not
establish whether the token expired, was revoked, or lost account permissions.

No Production deployment, merge, secret update, payment change, or database
mutation is part of this fix. No schema migration is required.

## Code correction

- Distinguish expired/invalid tokens, missing permissions, and inaccessible
  accounts using numeric Graph API error codes; never return raw provider
  messages, request URLs, or credentials.
- Preserve the existing database error-code contract while forwarding safe,
  actionable detail to the admin who initiated sync.
- Display a connection warning before cached spend. Retain historical values
  and timestamps; withhold acquisition costs/CAC/ROAS while spend is stale or
  the latest sync failed. A successful, current zero-spend report remains valid.
- Keep all calls read-only on Meta, admin-only on SamoSell, and restricted to
  the approved account. No additional permissions or tracking scripts.

## Owner handoff: restore the connection

1. In Meta app **Samosell Growth**, app ID `3054135721598772`, obtain a valid
   server-side access token with `ads_read` and access to **SamoSell Ads**,
   account ID `948841811174019`. Prefer a business system-user token with the
   account explicitly assigned. Confirm expiry and permissions using Meta's
   Access Token Debugger; do not assume a token never expires.
2. Set `META_ADS_ACCESS_TOKEN` privately in the approved Vercel environment.
   Never paste it into source, this document, GitHub, or application logs.
   The separate CAPI token is not a substitute.
3. Production secret changes and deployment require the owner's separate
   approval under the existing release restrictions. A new deployment is
   needed to use the updated environment variable.
4. After approval and deployment, run `Sync Meta spend` as an admin. Require
   a successful response and advancing `last_success_at`; then compare the
   displayed period with Ads Manager. This sync writes spend into the backend
   and must not be run against Production before approval.

Until these steps succeed, the external Meta connection remains unresolved.
Do not start a live campaign or modify billing to troubleshoot this error.

## Verification

Synthetic Graph responses cover expiry, invalid token, missing permissions,
account access, safe API output, and persistence of existing database error
codes. Dashboard tests verify cached zero spend cannot produce false zero
costs after a failed sync. Button tests verify actionable safe messages.
Preview is configured read-only with Meta sync and payments disabled; it
does not prove the Production token is valid.
