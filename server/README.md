# Bridge server (Phase 0)

One small box that holds the live connections to all five services and exposes a
single Matrix client-server API that the mobile app talks to.

```
mobile app ──HTTPS──▶ Synapse ◀── mautrix-{whatsapp,slack,linkedin,twitter,meta}
                        │
                      Sygnal ──▶ FCM / APNs (push)
```

## Prerequisites

- A VPS (1–2 GB RAM is plenty at personal scale) or a home server
- Docker + Docker Compose
- Strongly recommended: [Tailscale](https://tailscale.com) so the Matrix API is
  never exposed to the public internet. Otherwise put a TLS reverse proxy
  (Caddy/Traefik) in front of port 8008.

## Setup

1. `cp .env.example .env` and fill in `SERVER_NAME` and `POSTGRES_PASSWORD`.

2. **Generate the Synapse config** (first run only):
   ```bash
   docker compose run --rm synapse generate
   ```
   Then edit `data/synapse/homeserver.yaml`:
   - point the database at the `postgres` service,
   - `enable_registration: false` (create your one user with `register_new_matrix_user`),
   - disable federation (`federation_domain_whitelist: []`),
   - add each bridge registration file under `app_service_config_files:` as you
     bring bridges up (they live in `./config/registrations/`).

3. **Bring up Synapse + Postgres**, create your user:
   ```bash
   docker compose up -d synapse postgres
   docker compose exec synapse register_new_matrix_user -c /data/homeserver.yaml
   ```

4. **Bridges, one at a time.** Each mautrix bridge follows the same dance:
   ```bash
   # generate the bridge's config + registration into ./data/<bridge>/
   docker compose run --rm mautrix-whatsapp
   # edit ./data/whatsapp/config.yaml (homeserver address http://synapse:8008,
   # your user in the permissions map), copy registration.yaml into
   # ./config/registrations/, reference it in homeserver.yaml, restart synapse
   docker compose restart synapse && docker compose up -d mautrix-whatsapp
   ```
   Then log in by DMing the bridge bot from any Matrix client:
   - **WhatsApp**: send `login qr`, scan the QR with WhatsApp → Linked Devices
   - **Slack**: `login token` with a user token
   - **LinkedIn / Twitter / Instagram**: `login` and follow the cookie/credential
     prompts (unofficial APIs — see the risk table in `../PLAN.md`)

5. **Push (Sygnal)**: fill `config/sygnal.yaml` with your FCM service account /
   APNs key for the mobile app's bundle ID, then `docker compose up -d sygnal`.

## Day-2 operations

- Update everything: `docker compose pull && docker compose up -d`
- A bridge losing its session shows up as its bot leaving/erroring — re-run the
  `login` flow from a Matrix client; history is retained.
- Back up `./data/` (bridge sessions + message store) if you care about history.
