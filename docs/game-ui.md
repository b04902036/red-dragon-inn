# Playing at the sample table

Run `npm run dev:fixture` for an explicit sample demonstration, or `npm run dev` after [production content setup](production-content.md). Open the localhost address shown by Vite and enter your name. Select **Create room**. Copy the invite link into a separate browser tab or browser profile, enter another name, and select **Join room**. The lobby should show both seats as connected. Choose an available character; the host can then select **Start match**.

Your cards appear along the bottom. Other players show public stats and hand counts. Hover or focus a card for details; touch screens offer a separate **Details** control. Click or tap a card body to select it during discard, then click again to deselect. See [card interactions](card-interactions.md), [language selection](localization.md), and [optional audio](audio.md). All artwork is original CSS and initials; fixture cards contain original sample rules text.

To verify a turn visually:

1. Click two card bodies, click one again to deselect it, then select **Discard and draw**. Your hand returns to seven cards. Pass each phase-end Anytime decision to reach **Action**.
2. Play **Sample Friendly Shove**, then choose the other player. The source player receives response priority first; pass to the victim, who can respond with **Sample Brush It Off** or pass. Pass each remaining response window and phase-end grace in the tab with priority. A successfully ignored Shove leaves Fortitude unchanged.
3. Select **Order a Drink** and choose another player. Select **Take a Drink**, then pass the response windows. The revealed Drink appears on the stack and the Drink discard count increases after resolution.
4. Select **Continue turn** through elimination checking and the next turn. The other player becomes active.
5. On an Action phase, play **Sample Raise the Stakes**, pass the responses, and inspect the gambling pot and controller. Another player can take control with a Gambling/Cheating card or select **Pass gambling**. The winning controller receives the pot.
6. Refresh one tab. Its name, hand and current table should return with **Synced**. Each tab stores its own resume credential in session storage; invite links contain only a room code. Closing the tab loses that tab's credential.
7. In browser device emulation, use a 390 × 844 viewport. The phase and active player appear above the table, opponent panels and hand cards scroll horizontally, and contextual actions stay at the bottom. Complete a turn by tapping the same controls.
8. Use Tab/Shift+Tab to focus cards, Space/Enter to toggle selection, and Escape to dismiss previews. Target dialogs keep keyboard focus inside; mandatory effect choices must be confirmed. Stats and phases use text labels as well as visual styling.

Disconnecting retains the seat and disables game actions. The client reconnects with increasing delays up to five seconds. Opening the same saved credential elsewhere replaces the earlier connection; its **Reconnect** button can resume it. Commands never change critical state optimistically: acknowledgements and server projections drive the visible table.

`npm run test:e2e` automates the multiplayer sequence against a production build. `tests/e2e/gameplay.spec.ts` writes desktop/mobile screenshots under the ignored `.tools` directory. The compact table log describes changes to public projections; it is not the private domain-event history. Match persistence, replay and durable restart recovery are expanded in step 09.

For persistence, server restart, reconnect and the local replay report, follow [the step 09 visual checklist](persistence-replay.md#visual-verification).

## Server-authoritative playable cards

The hand uses the authenticated private `legalPlays` projection. The same server context, trigger, category and effect validators used for commands compute these entries, including exact targets and the current prompt identity. Presentation card types/text do not grant play permission. A newer public version clears old highlights until the matching private legal-play version arrives; reconnect and pending acknowledgements also disable play. Target dialogs close on a version change and contain only server-authorized targets.

Playable cards have a thick dashed green border, a visible **▶ Playable / ▶ 可出牌** badge, and an accessible description. Discard selection adds a check mark and gold ring independently, so an Anytime can display both states. Styling is static and respects reduced motion. Hover/focus details, touch Details controls, whole-card discard toggling and embedded button isolation remain available.

### Visual verification for steps 18–20

1. Run `npm run dev:fixture` and open its local URL. Create a room, then join its invite link in a separate browser context. Start the match. **Sample Quiet Breather** is playable during discard; ordinary Action cards are unmarked. Select/deselect the Breather using its card body or Space and check that both selection and playable cues remain distinct.
2. Select **Discard and draw**. During phase-end Anytime grace, only the current holder sees their Anytime highlighted and **Pass Anytime**. Pass in each tab with priority (or wait for expiry). In **Action**, the active player's **Sample Friendly Shove** is highlighted; the other player's Shove is unmarked. Focus a highlighted card to inspect its text, then Tab to Play and activate it with Enter. Its target dialog lists only valid targets.
3. Play Shove against the other player. The source player receives first response priority. Pass to the victim: **Sample Brush It Off** becomes highlighted. Play it and inspect the child response, countdown reset, and freshly recomputed cards. Only the current priority holder has response buttons. Pass remaining responses and subsequent phase-end grace to continue.
4. Let one countdown expire. The former holder loses the old highlights and buttons; the next holder receives the new prompt. Refresh that tab and confirm the same current hand/highlights and deadline return without restarting the timer.
5. Skip Action, pass grace, and confirm Action highlights disappear in **Order a Drink**. Switch to **繁體中文** and check **可出牌** on a legal card. Enable reduced motion in browser emulation: cues remain visible without animation. Inspect both tabs to confirm each shows only its own hand.
6. Sound starts after an ordinary gesture such as name entry or a game action. A new local Sometimes decision plays `public/audio/voice/en-US/sometimes-response.mp3` in either locale; phase-end Anytime uses no voice. Music and sound-effect controls remain independent. See [timed prompts](timed-prompts.md) for production 30/15-second deadlines; automated browser fixtures use 10/5 seconds.

`tests/e2e/playable-highlighting.spec.ts` saves an Action-phase screenshot to the ignored `.tools/step20-playable-action.png`.
