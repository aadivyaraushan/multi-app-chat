/* Manual capability verification of the MultiChat app via real browser driving.
 * Runs every user-facing capability end-to-end and reports PASS/FAIL per check.
 *
 * Two hard-won rules for driving stacked expo-router screens on web:
 *  1. Hidden screens keep their DOM (display:none) — scope EVERY selector,
 *     including text waits, to visible elements, or waitForSelector will bind
 *     to a hidden first match and hang.
 *  2. Never assume which screen a previous check ended on — goHome() first. */
const { chromium } = require('playwright');
const path = require('path');

const APP = 'http://localhost:8081';
const SHOTS = path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });

const results = [];
let page;

const tid = (id) => `[data-testid="${id}"]:visible`;
const txt = (s) => `:text("${s}"):visible`;

async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
    console.log('PASS |', name);
  } catch (e) {
    results.push(['FAIL', name, e.message.split('\n')[0]]);
    console.log('FAIL |', name, '|', e.message.split('\n')[0]);
    try {
      await page.screenshot({ path: path.join(SHOTS, `FAIL-${name.replace(/[^a-z0-9]+/gi, '-')}.png`) });
    } catch {}
  }
}

async function goHome() {
  const backs = ['back-btn', 'thread-back-btn', 'settings-back-btn', 'search-back-btn', 'connect-back-btn'];
  for (let i = 0; i < 5; i++) {
    if (await page.locator(tid('inbox-list')).count()) return;
    const sel = backs.map(tid).join(', ');
    const back = page.locator(sel).first();
    if (await back.count()) {
      await back.click();
      await page.waitForTimeout(350);
      continue;
    }
    break;
  }
  if (!(await page.locator(tid('inbox-list')).count())) {
    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForSelector(`${tid('inbox-list')}, ${tid('onboarding-empty')}`, { timeout: 30000 });
  }
}

async function openChat(convoId) {
  await goHome();
  await page.click(tid(`convo-${convoId}`));
  await page.waitForSelector(tid('message-list'), { timeout: 10000 });
}

async function longPress(locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
}

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-proxy-server', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await page.goto(APP, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);

  // ---------- 1. Onboarding ----------
  await check('onboarding: empty inbox shows connect-as-you-go cards', async () => {
    await page.waitForSelector(tid('onboarding-empty'), { timeout: 30000 });
    for (const s of ['whatsapp', 'slack', 'linkedin', 'x', 'instagram']) {
      if (!(await page.locator(tid(`connect-card-${s}`)).isVisible())) throw new Error(`card ${s} missing`);
    }
    await shot('01-onboarding');
  });

  // ---------- 2. WhatsApp phone-number pairing-code connect ----------
  await check('connect whatsapp: 8-character pairing-code flow', async () => {
    await page.click(tid('connect-card-whatsapp'));
    await page.waitForSelector(tid('phone-input'), { timeout: 10000 });
    // request-code button gated until a valid phone number is entered
    if (await page.locator(tid('whatsapp-pairing-code')).count()) throw new Error('code shown before phone entry');
    await page.fill(tid('phone-input'), '+1 555 123 4567');
    await page.click(tid('request-code-btn'));
    await page.waitForSelector(tid('whatsapp-pairing-code'), { timeout: 10000 });
    const code = (await page.locator(tid('whatsapp-pairing-code')).innerText()).trim();
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) throw new Error(`unexpected code format: ${code}`);
    await shot('02-whatsapp-pairing-code');
    await page.click(tid('code-entered-btn'));
    await page.waitForSelector(tid('convo-wa-mom'), { timeout: 10000 });
  });

  // ---------- 3. Slack token connect ----------
  await check('connect slack: token flow (submit gated on token)', async () => {
    await page.click(tid('connect-card-slack'));
    await page.waitForSelector(tid('token-input'), { timeout: 10000 });
    await page.click(tid('connect-submit'));
    await page.waitForTimeout(400);
    if (await page.locator(tid('convo-sl-devteam')).count()) throw new Error('connected without token');
    await page.fill(tid('token-input'), 'xoxs-test-token-123');
    await page.click(tid('connect-submit'));
    await page.waitForSelector(tid('convo-sl-devteam'), { timeout: 10000 });
  });

  // ---------- 4. Credential connects (LinkedIn, X, IG) with ToS warning ----------
  for (const [svc, seedConvo] of [['linkedin', 'li-recruiter'], ['x', 'x-founder'], ['instagram', 'ig-nadia']]) {
    await check(`connect ${svc}: credential flow with ToS warning`, async () => {
      await goHome();
      await page.click(tid(`connect-card-${svc}`));
      await page.waitForSelector(tid('username-input'), { timeout: 10000 });
      if ((await page.locator(tid('tos-warning')).count()) === 0) throw new Error('ToS warning not shown');
      await page.fill(tid('username-input'), 'me@example.com');
      await page.fill(tid('password-input'), 'hunter2');
      await page.click(tid('connect-submit'));
      await page.waitForSelector(tid(`convo-${seedConvo}`), { timeout: 10000 });
    });
  }

  // ---------- 5. Inbox structure ----------
  await check('inbox: merged list with service badges, unread counts, previews', async () => {
    await goHome();
    for (const b of ['badge-whatsapp', 'badge-slack', 'badge-linkedin', 'badge-x', 'badge-instagram']) {
      if ((await page.locator(tid(b)).count()) === 0) throw new Error(`${b} missing`);
    }
    if ((await page.locator(tid('unread-wa-mom')).count()) === 0) throw new Error('unread dot missing');
    const preview = await page.locator(tid('convo-wa-mom')).innerText();
    if (!preview.includes('Voice note')) throw new Error('voice-note preview missing');
    await shot('05-inbox-full');
  });

  // ---------- 6. Filter chips ----------
  await check('filter chips: per-service and unread filtering', async () => {
    await goHome();
    await page.click(tid('chip-slack'));
    await page.waitForTimeout(300);
    if ((await page.locator(tid('convo-wa-mom')).count()) !== 0) throw new Error('whatsapp visible under slack chip');
    if ((await page.locator(tid('convo-sl-devteam')).count()) === 0) throw new Error('slack convo missing under slack chip');
    await page.click(tid('chip-unread'));
    await page.waitForTimeout(300);
    if ((await page.locator(tid('convo-sl-sarah')).count()) !== 0) throw new Error('read convo visible under unread chip');
    if ((await page.locator(tid('convo-wa-mom')).count()) === 0) throw new Error('unread convo missing under unread chip');
    await shot('06-filter-unread');
    await page.click(tid('chip-all'));
    await page.waitForTimeout(300);
  });

  // ---------- 7. Open chat: render, voice note, unread cleared ----------
  await check('chat: opens, renders history incl. voice note, clears unread', async () => {
    await openChat('wa-mom');
    if ((await page.locator(tid('voice-wa-mom-4')).count()) === 0) throw new Error('voice note bubble missing');
    await shot('07-whatsapp-chat');
    await goHome();
    if ((await page.locator(tid('unread-wa-mom')).count()) !== 0) throw new Error('unread not cleared');
  });

  // ---------- 8. Send + delivery pipeline + typing + auto-reply + read receipts ----------
  await check('send message: status ticks -> read, typing indicator, reply arrives', async () => {
    await openChat('wa-mom');
    const before = await page.locator(tid('message-list')).locator('[data-testid^="bubble-"]:visible').count();
    await page.fill(tid('composer-input'), 'Will do, calling you at 8');
    await page.click(tid('send-btn'));
    await page.waitForSelector(txt('Will do, calling you at 8'), { timeout: 5000 });
    await page.waitForSelector(txt('is typing'), { timeout: 6000 });
    await shot('08-typing');
    await page.waitForSelector(tid('ticks-read'), { timeout: 8000 });
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid^="bubble-"]').length >= n,
      before + 2,
      { timeout: 8000 },
    );
    await shot('08-reply-arrived');
  });

  // ---------- 9. Reactions ----------
  await check('reactions: long-press react, pill renders, toggle off', async () => {
    await openChat('wa-mom');
    const bubble = page.locator(tid('bubble-wa-mom-3'));
    await longPress(bubble);
    await page.waitForSelector(tid('react-👍'), { timeout: 5000 });
    await shot('09-action-sheet');
    await page.click(tid('react-👍'));
    await page.waitForSelector(tid('reaction-wa-mom-3-👍'), { timeout: 5000 });
    await page.click(tid('reaction-wa-mom-3-👍'));
    await page.waitForTimeout(400);
    if ((await page.locator(tid('reaction-wa-mom-3-👍')).count()) !== 0) throw new Error('reaction did not toggle off');
    await longPress(bubble);
    await page.click(tid('react-❤️'));
    await page.waitForSelector(tid('reaction-wa-mom-3-❤️'));
  });

  // ---------- 10. Reply-quoting ----------
  await check('reply: quote a message and send', async () => {
    await openChat('wa-mom');
    await longPress(page.locator(tid('bubble-wa-mom-3')));
    await page.waitForSelector(tid('action-reply'), { timeout: 5000 });
    await page.click(tid('action-reply'));
    await page.waitForSelector(txt('Replying to Mom'), { timeout: 5000 });
    await page.fill(tid('composer-input'), 'Yes — tonight works');
    await page.click(tid('send-btn'));
    await page.waitForTimeout(600);
    const quoted = await page.locator(txt('Call me when you settle in tonight')).count();
    if (quoted < 2) throw new Error('reply preview not rendered in sent bubble');
    await shot('10-reply-sent');
  });

  // ---------- 11. Copy action ----------
  await check('copy: action available on text messages', async () => {
    await openChat('wa-mom');
    await longPress(page.locator(tid('bubble-wa-mom-2')));
    await page.waitForSelector(tid('action-copy'), { timeout: 5000 });
    await page.click(tid('action-copy'));
    await page.waitForTimeout(300);
  });

  // ---------- 12. Image attach ----------
  await check('media: attach and send an image', async () => {
    await openChat('wa-mom');
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 8000 }),
      page.click(tid('attach-btn')),
    ]);
    await chooser.setFiles(path.join(__dirname, 'test-image.png'));
    await page.waitForSelector('[data-testid^="image-msg-"]:visible', { timeout: 8000 });
    await shot('12-image-sent');
  });

  // ---------- 13. Voice note (WhatsApp only) ----------
  await check('voice note: record and send in WhatsApp', async () => {
    await openChat('wa-mom');
    await page.click(tid('mic-btn'));
    await page.waitForSelector(tid('recording-bar'), { timeout: 5000 });
    await page.waitForTimeout(1200);
    await page.click(tid('mic-btn'));
    await page.waitForSelector('[data-testid^="voice-msg-"]:visible', { timeout: 5000 });
    await shot('13-voice-sent');
  });

  // ---------- 14. Adaptive gaps: X chat ----------
  await check('adaptive: X chat has no mic, no typing indicator, read receipts on', async () => {
    await openChat('x-founder');
    if ((await page.locator(tid('mic-btn')).count()) !== 0) throw new Error('mic shown in X chat');
    await page.fill(tid('composer-input'), 'lets do it — next week?');
    await page.click(tid('send-btn'));
    let sawTyping = false;
    try {
      await page.waitForSelector(txt('is typing'), { timeout: 2500 });
      sawTyping = true;
    } catch {}
    if (sawTyping) throw new Error('typing indicator shown for X');
    await page.waitForSelector(tid('ticks-read'), { timeout: 8000 });
    await shot('14-x-chat');
  });

  // ---------- 15. Adaptive gaps: LinkedIn action sheet ----------
  await check('adaptive: LinkedIn action sheet has reactions but no Reply', async () => {
    await openChat('li-recruiter');
    await longPress(page.locator(tid('bubble-li-rec-3')));
    await page.waitForSelector(tid('react-👍'), { timeout: 5000 });
    if ((await page.locator(tid('action-reply')).count()) !== 0) throw new Error('Reply offered in LinkedIn');
    await shot('15-linkedin-sheet');
    await page.click(tid('actions-backdrop'), { position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
  });

  // ---------- 16. Adaptive gaps: Slack no read receipts ----------
  await check('adaptive: Slack send stays at delivered (no read receipts)', async () => {
    await openChat('sl-sarah');
    await page.fill(tid('composer-input'), 'pushed the fix, can you re-review?');
    await page.click(tid('send-btn'));
    await page.waitForTimeout(3500);
    if ((await page.locator(tid('ticks-read')).count()) !== 0) throw new Error('read receipt shown for Slack');
  });

  // ---------- 17. Slack threads ----------
  await check('slack threads: indicator, thread view, reply in thread', async () => {
    await openChat('sl-devteam');
    await page.waitForSelector(tid('thread-link-sl-dev-2'), { timeout: 8000 });
    const label = await page.locator(tid('thread-link-sl-dev-2')).innerText();
    if (!label.includes('2')) throw new Error(`expected 2 replies, saw: ${label}`);
    await page.click(tid('thread-link-sl-dev-2'));
    await page.waitForSelector(tid('thread-list'), { timeout: 8000 });
    await shot('17-thread-view');
    await page.fill(tid('composer-input'), 'same — mocking the clock fixed it for us');
    await page.click(tid('send-btn'));
    await page.waitForTimeout(700);
    await page.click(tid('thread-back-btn'));
    await page.waitForSelector(tid('thread-link-sl-dev-2'));
    const label2 = await page.locator(tid('thread-link-sl-dev-2')).innerText();
    if (!label2.includes('3')) throw new Error(`thread count did not grow: ${label2}`);
  });

  await check('slack action sheet: Reply in thread offered, plain Reply absent', async () => {
    await openChat('sl-devteam');
    await longPress(page.locator(tid('bubble-sl-dev-1')));
    await page.waitForSelector(tid('action-thread-reply'), { timeout: 5000 });
    if ((await page.locator(tid('action-reply')).count()) !== 0) throw new Error('plain Reply offered in Slack');
    await page.click(tid('actions-backdrop'), { position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
  });

  // ---------- 18. Group chat ----------
  await check('group chat: sender names shown, seeded multi-person reaction', async () => {
    await openChat('wa-family');
    if ((await page.locator(txt('Jake Torres')).count()) === 0) throw new Error('sender name missing in group');
    if ((await page.locator(tid('reaction-wa-fam-2-👍')).count()) === 0) throw new Error('seeded reaction missing');
    const pill = await page.locator(tid('reaction-wa-fam-2-👍')).innerText();
    if (!pill.includes('2')) throw new Error('reaction count missing');
  });

  // ---------- 19. Notifications ----------
  await check('notifications: banner for incoming message when not viewing', async () => {
    await openChat('ig-nadia');
    await page.fill(tid('composer-input'), 'sending the route now');
    await page.click(tid('send-btn'));
    await page.click(tid('back-btn'));
    await page.waitForSelector(tid('notification-banner'), { timeout: 8000 });
    const text = await page.locator(tid('notification-banner')).innerText();
    if (!text.includes('Instagram')) throw new Error('banner missing service name');
    await shot('19-banner');
    await page.click(tid('notification-banner'));
    await page.waitForSelector(tid('message-list'), { timeout: 5000 });
  });

  await check('notifications: per-chat mute suppresses banner', async () => {
    await openChat('ig-nadia');
    await page.click(tid('chat-mute-btn'));
    await page.fill(tid('composer-input'), 'also there is a waterfall detour');
    await page.click(tid('send-btn'));
    await page.click(tid('back-btn'));
    let saw = false;
    try {
      await page.waitForSelector(tid('notification-banner'), { timeout: 6000 });
      saw = true;
    } catch {}
    if (saw) throw new Error('banner shown for muted chat');
    // unmute for later checks
    await openChat('ig-nadia');
    await page.click(tid('chat-mute-btn'));
  });

  await check('notifications: per-service toggle suppresses banner', async () => {
    await goHome();
    await page.click(tid('settings-btn'));
    await page.waitForSelector(tid('notif-instagram'), { timeout: 5000 });
    await page.click(tid('notif-instagram')); // off
    await page.click(tid('settings-back-btn'));
    await openChat('ig-nadia');
    await page.fill(tid('composer-input'), 'one more thing');
    await page.click(tid('send-btn'));
    await page.click(tid('back-btn'));
    let saw = false;
    try {
      await page.waitForSelector(tid('notification-banner'), { timeout: 6000 });
      saw = true;
    } catch {}
    if (saw) throw new Error('banner shown with service notifications off');
    await page.click(tid('settings-btn'));
    await page.click(tid('notif-instagram')); // restore
    await page.click(tid('settings-back-btn'));
  });

  // ---------- 20. Inbox long-press actions ----------
  await check('inbox actions: long-press mark-as-read and mute', async () => {
    await openChat('sl-sarah');
    await page.fill(tid('composer-input'), 'ping');
    await page.click(tid('send-btn'));
    await page.click(tid('back-btn'));
    await page.waitForSelector(tid('unread-sl-sarah'), { timeout: 8000 });
    await longPress(page.locator(tid('convo-sl-sarah')));
    await page.waitForSelector(tid('action-mark-read'), { timeout: 5000 });
    await page.click(tid('action-mark-read'));
    await page.waitForTimeout(400);
    if ((await page.locator(tid('unread-sl-sarah')).count()) !== 0) throw new Error('mark-read failed');
    await longPress(page.locator(tid('convo-sl-sarah')));
    await page.waitForSelector(tid('action-mute'), { timeout: 5000 });
    await page.click(tid('action-mute'));
    await page.waitForTimeout(400);
    await shot('20-muted-row');
    await longPress(page.locator(tid('convo-sl-sarah')));
    await page.waitForSelector(tid('action-mute'), { timeout: 5000 });
    await page.click(tid('action-mute'));
    await page.waitForTimeout(300);
  });

  // ---------- 21. Search ----------
  await check('search: message content, conversation names, service filter', async () => {
    await goHome();
    await page.click(tid('search-btn'));
    await page.waitForSelector(tid('search-input'), { timeout: 5000 });
    await page.fill(tid('search-input'), 'staging');
    await page.waitForSelector(tid('result-msg-sl-dev-1'), { timeout: 5000 });
    await page.click(tid('chip-whatsapp'));
    await page.waitForTimeout(400);
    if ((await page.locator(tid('result-msg-sl-dev-1')).count()) !== 0) throw new Error('filter not applied in search');
    await page.click(tid('chip-all'));
    await page.fill(tid('search-input'), 'Mom');
    await page.waitForSelector(tid('result-convo-wa-mom'), { timeout: 5000 });
    await shot('21-search');
    await page.click(tid('result-convo-wa-mom'));
    await page.waitForSelector(tid('message-list'), { timeout: 5000 });
  });

  // ---------- 22. Appearance ----------
  await check('appearance: dark mode applies and persists across reload', async () => {
    await goHome();
    await page.click(tid('settings-btn'));
    await page.waitForSelector(tid('appearance-dark'), { timeout: 5000 });
    await page.click(tid('appearance-dark'));
    await page.waitForSelector(tid('theme-dark'), { timeout: 5000 });
    await shot('22-dark-settings');
    await page.click(tid('settings-back-btn'));
    await shot('22-dark-inbox');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector(tid('theme-dark'), { timeout: 30000 });
  });

  // ---------- 23. Persistence across reload ----------
  await check('persistence: all five services still connected after reload', async () => {
    await page.waitForSelector(tid('convo-wa-mom'), { timeout: 15000 });
    for (const c of ['convo-sl-devteam', 'convo-li-recruiter', 'convo-x-founder', 'convo-ig-nadia']) {
      if ((await page.locator(tid(c)).count()) === 0) throw new Error(`${c} gone after reload`);
    }
  });

  // ---------- 24. Disconnect ----------
  await check('disconnect: service removal clears its conversations and chip', async () => {
    await goHome();
    await page.click(tid('settings-btn'));
    await page.waitForSelector(tid('disconnect-x'), { timeout: 5000 });
    await page.click(tid('disconnect-x'));
    await page.waitForSelector(tid('connect-x'), { timeout: 5000 });
    await page.click(tid('settings-back-btn'));
    if ((await page.locator(tid('convo-x-founder')).count()) !== 0) throw new Error('X convo still visible');
    if ((await page.locator(tid('chip-x')).count()) !== 0) throw new Error('X chip still visible');
    if ((await page.locator(tid('connect-card-x')).count()) === 0) throw new Error('X connect card missing');
    await shot('24-x-disconnected');
  });

  // ---------- 25. Back to light ----------
  await check('appearance: back to light mode', async () => {
    await goHome();
    await page.click(tid('settings-btn'));
    await page.waitForSelector(tid('appearance-light'), { timeout: 5000 });
    await page.click(tid('appearance-light'));
    await page.waitForSelector(tid('theme-light'), { timeout: 5000 });
    await page.click(tid('settings-back-btn'));
    await shot('25-final-inbox');
  });

  console.log('\n================ SUMMARY ================');
  const fails = results.filter((r) => r[0] === 'FAIL');
  console.log(`${results.length - fails.length}/${results.length} checks passed`);
  for (const f of fails) console.log('FAILED:', f[1], '-', f[2]);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
