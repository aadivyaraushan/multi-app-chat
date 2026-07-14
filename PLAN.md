# Multi-App Chat — Product & Technical Plan

A single mobile app where all your conversations live: LinkedIn, X (Twitter), Slack, Instagram, and WhatsApp — with everything that isn't chat stripped away. No feeds, no stories, no job posts. Just messages.

Built as a **personal tool** (not a public product), which shapes several decisions below: credentials and ban-risk are your own, there's no multi-tenant infrastructure, and pragmatism beats polish where they conflict.

---

## 1. Confirmed product decisions

These were reviewed and approved during planning:

| Decision | Choice |
|---|---|
| Connection strategy | Unofficial APIs / bridges feeding a fully custom UI (Beeper-style) |
| Platform | Mobile app — React Native + Expo (iOS + Android from one codebase) |
| Audience | Personal tool / side project |
| Inbox model | One merged inbox — all services in a single chronological list |
| Visual identity | Neutral & calm, one unified aesthetic; service shown only as a small colored badge on the avatar |
| Navigation | Inbox-first, minimal chrome — no tab bar; settings/accounts behind an avatar tap |
| Conversation rows | Standard two-line: avatar + service badge, name, one-line preview, timestamp, unread dot |
| Feature gaps | Shared core everywhere (text, images, replies, **reactions** — supported by all five services); service-specific extras (Slack threads, WhatsApp voice notes) appear adaptively only where supported; the app never shows a dead button |
| Inbox filtering | Horizontally scrollable filter-chip row under the header: All · Unread · WhatsApp · Slack · LinkedIn · X · IG |
| Notifications | Unified notifications from this app, with **per-service toggles** (e.g. LinkedIn off, WhatsApp on) and **per-chat mute** |
| Onboarding | Connect-as-you-go: welcome screen → empty inbox with five "Connect …" cards; no forced wizard |

---

## 2. Architecture

```
┌─────────────────────────────┐
│   React Native + Expo app   │  ← custom unified chat UI (the only UI you see)
│   (matrix-js-sdk client)    │
└──────────────┬──────────────┘
               │ Matrix client-server API (HTTPS + sync)
┌──────────────▼──────────────┐
│  Personal bridge server     │  ← one small VPS / home server, Docker Compose
│  ┌───────────────────────┐  │
│  │ Matrix homeserver     │  │  (Synapse)
│  └───────────┬───────────┘  │
│  ┌───────────┴───────────┐  │
│  │ mautrix bridges       │  │
│  │  • mautrix-whatsapp   │──┼──→ WhatsApp multi-device (phone-code pairing) ✅ official-protocol-adjacent
│  │  • mautrix-slack      │──┼──→ Slack (real API / user token)      ✅ sanctioned
│  │  • mautrix-linkedin   │──┼──→ LinkedIn messaging (unofficial)    ⚠️ ToS risk
│  │  • mautrix-twitter    │──┼──→ X DMs (unofficial)                 ⚠️ ToS risk
│  │  • mautrix-meta       │──┼──→ Instagram DMs (unofficial)         ⚠️ ToS risk
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Sygnal push gateway   │──┼──→ FCM / APNs → phone notifications
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Why Matrix + mautrix bridges (rather than reverse-engineering five protocols yourself)

- The mautrix bridge family already solves the hardest problem — maintained, battle-tested unofficial clients for exactly these services, including **WhatsApp multi-device pairing via an 8-character phone code** (via whatsmeow), which was a hard requirement.
- Matrix gives you for free: a unified message model (rooms, events, reactions, replies, media), end-to-end sync across devices, read receipts, typing indicators where available, and a push-notification pipeline (Sygnal).
- When a service changes its private API and breaks, you update one bridge container instead of debugging your own protocol code. This is the whole maintenance story for a personal project.
- The mobile app becomes "just" a Matrix client with a heavily opinionated UI — which is where all the differentiated work (the UX) should go anyway.

### Components

| Component | Choice | Notes |
|---|---|---|
| Homeserver | Synapse | Best bridge compatibility and docs; fine at personal scale |
| WhatsApp | mautrix-whatsapp | 8-character phone-code pairing (Link with phone number instead) — no camera/QR needed |
| Slack | mautrix-slack | Uses your user token; the one fully sanctioned integration |
| LinkedIn | mautrix-linkedin | Cookie/credential-based; unofficial |
| X | mautrix-twitter | Cookie-based; unofficial. Highest breakage risk of the five — see Risks |
| Instagram | mautrix-meta | Meta's private messaging API; unofficial |
| Push | Sygnal + Expo Notifications (FCM/APNs) | Notification payloads stay minimal; app fetches content on open |
| Mobile app | React Native + Expo, matrix-js-sdk, Expo Router | E2E-encrypted Matrix storage via a secure store |
| Deployment | Docker Compose on a small VPS (or home server + Tailscale) | Single `docker-compose.yml` for homeserver + 5 bridges + Sygnal |

### Security notes (personal-scale, still worth doing)

- The bridge server holds live sessions for all five accounts — lock it down: Tailscale-only or TLS + firewall, no public Matrix federation, registration disabled.
- Service credentials/cookies live only on the server, never in the mobile app.
- Enable Matrix E2E encryption between app and homeserver where bridges support it.

---

## 3. UX specification (approved)

### 3.1 Screens

The entire app is four screens. That is the point.

**① Inbox (home)**
- Opens directly here. Header: app name left, search icon, your avatar right (→ Accounts & Settings).
- Under the header: the **filter chip row** — `All · Unread · WhatsApp · Slack · LinkedIn · X · IG`. One tap to focus, tap `All` to return. Chips for unconnected services don't appear.
- Conversation list, merged across services, sorted by latest activity. Each row: contact/group avatar with a small service badge (bottom-right corner, service brand color — the only brand color in the app), name, one-line message preview, relative timestamp, unread dot. Swipe actions: mute / mark read.
- Empty state (first run): five "Connect WhatsApp / Slack / LinkedIn / X / Instagram" cards — this *is* the onboarding.

**② Chat**
- Clean bubble view, one visual language for all services. Header: avatar + name + service badge, no service chrome.
- **Shared core, available in every chat:** text, images/media, reply-quoting, emoji **reactions** (all five services support reactions), delivery status where the service reports it.
- **Adaptive extras, shown only where supported:** Slack threads (inline collapsed thread indicator → thread view), WhatsApp voice notes, typing indicators, read receipts. Unsupported controls are absent, never grayed out.
- Composer: text field, attach, emoji; long-press a message for reply/react/copy.

**③ Accounts & Settings** (via avatar tap)
- Connected services list with status (connected / reconnect needed) and a Connect button for missing ones.
- WhatsApp connect flow: enter the account's phone number → server returns an 8-character code → type it into the phone's WhatsApp (Linked Devices → Link a Device → "Link with phone number instead"). Slack: token/OAuth flow. LinkedIn/X/IG: credential or cookie entry with a plain-language note about unofficial-API risk.
- **Notifications:** master toggle → per-service toggles → (per-chat mute lives on the chat itself). Quiet-hours toggle.
- Appearance: light/dark/system.

**④ Search**
- Full-screen search over conversation names and message content, same filter chips apply.

### 3.2 Visual language

- Neutral, calm, near-monochrome palette; generous whitespace; system fonts (SF Pro / Roboto). Light + dark mode from day one.
- Service brand colors appear in exactly two places: avatar badges and filter chips. Nothing else is branded.
- No feed, no discover, no profile pages, no stories ring — deliberately nothing to scroll except conversations.

### 3.3 Notifications behavior

- All messages notify through this one app; the notification shows contact name, service, and preview (per-service preview-privacy toggle).
- Per-service on/off in settings; per-chat mute via swipe or chat header.
- Expectation: you silence the five original apps and let this app be the single source of message interruptions.

---

## 4. Feature matrix (v1 targets)

| Capability | WhatsApp | Slack | LinkedIn | X | Instagram |
|---|---|---|---|---|---|
| Send/receive text | ✅ | ✅ | ✅ | ✅ | ✅ |
| Images & media | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reactions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reply-quoting | ✅ | ✅ (thread) | — | ✅ | ✅ |
| Group chats | ✅ | ✅ (channels) | ✅ | ✅ | ✅ |
| Threads UI | — | ✅ | — | — | — |
| Voice notes | ✅ | v2 | — | — | v2 |
| Typing indicators | ✅ | ✅ | ✅ | — | ✅ |
| Read receipts | ✅ | — | ✅ | ✅ | ✅ |

(— = the service itself doesn't support it or the bridge doesn't carry it; UI simply omits it.)

Out of scope for v1: calls, stories/status, posting, Slack huddles, channels-you're-not-in discovery, message scheduling.

---

## 5. Build phases

**Phase 0 — Bridge server up (≈ a weekend)**
Provision VPS → Docker Compose with Synapse + mautrix-whatsapp + mautrix-slack → pair WhatsApp via phone code, connect Slack → verify messages flow using any existing Matrix client (Element) as a throwaway UI. *Proves the whole architecture before writing any app code.*

**Phase 1 — App MVP: inbox + chat (2–3 weeks of evenings)**
Expo app with matrix-js-sdk: merged inbox with two-line rows + service badges, chat screen with the shared core (text, images, replies, reactions), filter chips, dark/light. WhatsApp + Slack only.

**Phase 2 — Remaining bridges + onboarding (1–2 weeks)**
Add mautrix-linkedin, mautrix-twitter, mautrix-meta. Build the connect-as-you-go cards and each service's connect flow (phone-code screen for WhatsApp done in Phase 1 testing, credential flows for the rest).

**Phase 3 — Notifications + polish (1–2 weeks)**
Sygnal + FCM/APNs push, per-service toggles, per-chat mute, search, swipe actions, Slack thread view, typing/read indicators, empty/error/reconnect states.

**Phase 4 — Live with it, then iterate**
Daily-drive it; likely follow-ups: voice notes, media gallery per chat, pinned chats, quiet hours.

---

## 6. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Account bans on LinkedIn / X / IG (unofficial API use violates their ToS) | High | Personal-scale usage patterns look like a normal single user; keep session behavior conservative (no polling storms — bridges are event-driven). Accept the risk consciously; it's your account. |
| X bridge breakage (X aggressively churns its private API; mautrix-twitter has historically lagged) | High | Treat X as the flakiest integration; ship it last, degrade gracefully (service shows "reconnect needed", rest of app unaffected). |
| WhatsApp device-pairing eviction (linked devices get logged out occasionally) | Medium | Reconnect-needed state + notification prompting a re-pair (new phone code); bridge retains history. |
| Bridge/homeserver maintenance burden | Medium | Docker Compose + watchtower-style updates; everything is containers on one box. |
| Meta (IG) login challenges / checkpoint loops | Medium | mautrix-meta handles most flows; fallback is re-entering a fresh session cookie. |
| Server compromise = all five accounts compromised | Medium | Tailscale-only access, no federation, disk encryption, standard hardening. |

---

## 7. Proposed repo structure

```
multi-app-chat/
├── PLAN.md                  ← this document
├── server/                  ← bridge server config
│   ├── docker-compose.yml   ← Synapse + 5 bridges + Sygnal
│   └── config/              ← homeserver + per-bridge configs (secrets gitignored)
└── app/                     ← Expo React Native app
    ├── app/                 ← Expo Router screens (inbox, chat/[id], settings, search)
    ├── src/
    │   ├── matrix/          ← client wrapper, sync, room→conversation mapping
    │   ├── services/        ← per-service metadata (badges, capability flags)
    │   ├── components/      ← ConversationRow, MessageBubble, FilterChips, ConnectCard…
    │   └── notifications/
    └── …
```

The capability-flags module (`services/`) is what powers the adaptive UI: each service declares `{ reactions: true, threads: false, voiceNotes: true, … }` and components render from that — one chat screen, no per-service forks.
