# Duplicate listing image cleanup — 2026-10-16

Production incident: a successful listing creation was followed by a duplicate POST returning HTTP 409. A subsequent upload-abort deleted the original listing's images. The duplicate record was moved to draft; the valid record remains active.

Fix requirements: preserve committed image objects on retried publishes; reuse a stable attempt ID; check committed listing state before any cleanup; add regression tests for duplicate retries and missing images. Do not deploy without passing tests.
