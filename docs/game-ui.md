# Playing at the sample table

Run `npm run dev`, open the localhost address shown by Vite, and enter your name. Select **Create room**. Copy the invite link into a separate browser tab or browser profile, enter another name, and select **Join room**. The lobby should show both seats as connected. Choose an available sample character; the host can then select **Start sample match**.

Your cards appear along the bottom. Other players show public stats and hand counts. Read any card with its **Read** button. All artwork is original CSS and initials; the cards contain original sample rules text.

To verify a turn visually:

1. Select a discard checkbox and select **Discard and draw**. Your hand returns to seven cards and the phase changes to **Action**.
2. Play **Sample Friendly Shove**, then choose the other player. Their table shows response priority. They can respond with **Sample Brush It Off** or pass. Pass each remaining response window in the tab with priority. A successfully ignored Shove leaves Fortitude unchanged.
3. Select **Order a Drink** and choose another player. Select **Take a Drink**, then pass the response windows. The revealed Drink appears on the stack and the Drink discard count increases after resolution.
4. Select **Continue turn** through elimination checking and the next turn. The other player becomes active.
5. On an Action phase, play **Sample Raise the Stakes**, pass the responses, and inspect the gambling pot and controller. Another player can take control with a Gambling/Cheating card or select **Pass gambling**. The winning controller receives the pot.
6. Refresh one tab. Its name, hand and current table should return with **Synced**. Each tab stores its own resume credential in session storage; invite links contain only a room code. Closing the tab loses that tab's credential.
7. In browser device emulation, use a 390 × 844 viewport. The phase and active player appear above the table, opponent panels and hand cards scroll horizontally, and contextual actions stay at the bottom. Complete a turn by tapping the same controls.
8. Use Tab/Shift+Tab and Enter to navigate controls. Card and target dialogs support Escape and keep keyboard focus inside; mandatory effect choices must be confirmed. Stats and phases use text labels as well as visual styling.

Disconnecting retains the seat and disables game actions. The client reconnects with increasing delays up to five seconds. Opening the same saved credential elsewhere replaces the earlier connection; its **Reconnect** button can resume it. Commands never change critical state optimistically: acknowledgements and server projections drive the visible table.

`npm run test:e2e` automates the multiplayer sequence against a production build. `tests/e2e/gameplay.spec.ts` writes desktop/mobile screenshots under the ignored `.tools` directory. The compact table log describes changes to public projections; it is not the private domain-event history. Match persistence, replay and durable restart recovery are expanded in step 09.

For persistence, server restart, reconnect and the local replay report, follow [the step 09 visual checklist](persistence-replay.md#visual-verification).
