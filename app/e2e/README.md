# End-to-end verification

Two harnesses, two layers.

## `verify.js` — the app UX (MockProvider)

Drives the running Expo web build in a real browser through all 30 user-facing
capabilities. See `docs/verification/VERIFICATION.md` for the report.

```bash
npx expo start --web --port 8081     # terminal 1
node e2e/verify.js                   # terminal 2  (needs a local playwright)
```

## `matrix-provider.verify.ts` — the live backend (MatrixProvider)

Verifies `src/providers/MatrixProvider.ts` against a **real Matrix homeserver**,
with no bridges required: a second client (bob) plays the remote contact and
tags the room with the same `m.bridge` state event a mautrix portal uses, so the
provider's real service-detection path runs. Asserts service detection, message
sync, send, reply, thread, incoming/outgoing reactions, read-receipt status, and
unread/markRead — 11/11.

Bring up a throwaway Synapse (SQLite, no Docker needed) and register two users:

```bash
python3 -m venv venv && ./venv/bin/pip install matrix-synapse
./venv/bin/python -m synapse.app.homeserver --server-name mc.local \
  --config-path homeserver.yaml --generate-config --report-stats=no
# in homeserver.yaml: bind only 127.0.0.1, and set
#   enable_registration: true
#   enable_registration_without_verification: true
./venv/bin/python -m synapse.app.homeserver -c homeserver.yaml &
./venv/bin/register_new_matrix_user -c homeserver.yaml -u alice -p alicepass --no-admin http://localhost:8008
./venv/bin/register_new_matrix_user -c homeserver.yaml -u bob   -p bobpass   --no-admin http://localhost:8008
```

Then bundle and run the harness (it imports the provider straight from `src/`):

```bash
npx esbuild e2e/matrix-provider.verify.ts --bundle --platform=node \
  --target=node22 --format=cjs --external:matrix-js-sdk --outfile=/tmp/mv.cjs
node /tmp/mv.cjs
```

To point the actual app at a homeserver instead of the seeded provider, set
`EXPO_PUBLIC_MATRIX_BASE_URL` (and `EXPO_PUBLIC_MATRIX_USER_ID` +
`EXPO_PUBLIC_MATRIX_PASSWORD`) — see `src/providers/index.ts`.
