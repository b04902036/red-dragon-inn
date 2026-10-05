# Local development card selection

Start `npm run dev:cards` to use the activated local production edition with card selection enabled. If private RDI1 input is unavailable, run `npm run db:migrate`, `npm run db:seed`, then `npm run dev:fixture:cards` for explicit sample content. The fixture edition has a sample Drink Event, but does not contain Drink Contest.

Open the loopback URL printed by Vite and create a **new room**. Existing rooms keep their original development setting. Join from another browser profile and start a match. Only the active player's normal Discard/Draw or Order Drink phase shows the bilingual development panel.

## Use

During Discard/Draw, select the hand cards to discard as usual. The panel creates one dropdown for each needed replacement. Choose every replacement, then press **Discard and take chosen cards / 棄牌並取得指定牌**. You can choose existing copies from your character deck or discard, including the cards you just discarded. Copies kept in hand are unavailable. The hand-size limit still applies; when supply is exhausted, choose only the available replacements.

During Order Drink, choose a **Drink or Drink Event** and a living opponent, then press **Order chosen Drink / 買指定的酒**. The server puts that physical copy on top of the opponent's face-down Drink pile. This does not immediately execute a Drink Event. Regular action buttons remain available and retain normal random draws.

The controls use native labeled dropdowns and buttons; hand selection retains pointer and keyboard access. In-flight commands disable selection. Selection fields reset when the state version or selected discards change.

## Current Drink Contest behavior

When a Drink Event containing `DRINKING_CONTEST` is revealed as the main Drink source, its ordinary response window resolves before the contest starts. All living players participate. Each round reveals a Drink from the Inn for every participant, including applicable Chasers; each player's Drink/effect and response windows resolve through the regular stack.

Scores are captured from the revealed compound Drink's Alcohol value, clamped to zero. A Drink Event revealed during the contest scores zero and executes its effects. Ignore may prevent drinking effects but does not remove the revealed score. Equal highest scores trigger another round for only those tied participants. Once one player wins, every other non-eliminated player pays that winner one Gold through the ordinary payment/response workflow. Elimination is evaluated after pending resolution/grace, consistent with existing engine timing.

A Drink Event encountered as a Chaser is discarded according to the pinned Chaser policy instead of starting the event. Buying Drink Contest therefore only places it in the recipient's Drink pile; it starts when subsequently revealed as the main Drink. These statements describe the current implementation, not a new rules change.

## Authority and replay

`DEV_CARD_SELECTION` is false in the default production and ordinary fixture environments. Dedicated `dev` and `dev-fixture` environments set it true; the entry Worker additionally requires a loopback URL when creating the room. The public creation schema does not accept a client development flag. The normal deployment script rejects non-default environments.

The server pins `devCardSelection: true` into development-room records and match rules. `DEV_DISCARD_DRAW` submits discarded instance IDs plus desired definition IDs; `DEV_ORDER_DRINK` submits a recipient and desired definition ID. The engine verifies active player, phase, pending resolution, hand ownership, exact replacement count and available physical copies. A rejected request cannot partially mutate state or RNG. No copies are fabricated, other hands/Drink piles cannot supply a chosen card, and chosen movements do not advance RNG.

Accepted commands use existing discard/draw/order events and the normal durable commit, history, D1 outbox and replay path. Full replay uses pinned development rules. Reconnect/hibernation retain the result. Private `devChoices` includes aggregated owner character supply and available Inn supply with no physical IDs or deck order; public state never contains the menus. A runtime with the switch disabled strips these choices and rejects development commands even on a previously saved development match.

## Files and verification

Engine/protocol changes: `src/engine/dev-card-selection.ts`, `turn.ts`, `rules.ts`, and command/private-view/projection contracts. Runtime changes: `worker/index.ts`, Durable Object room record/command/projection handling, and Wrangler environments. UI changes: `src/client/DevCardPicker.tsx`, `GameTable.tsx`, styles and bilingual messages. Tooling changes: development launcher/npm scripts and separate development Workers/Playwright projects.

Regressions cover selected deck/discard copies, counts, ownership, unavailable definitions, RNG preservation, hidden information, deterministic replay, disabled runtime, forged mode flags, remote URLs, actual socket persistence/eviction, bilingual keyboard UI, recipient selection and a real Chrome journey. The developer panel lives in the scrolling page so multiple replacement fields do not expand the fixed hand dock; the Chrome journey also verifies mobile-sized ordering controls.

Verified on 2026-10-05:

| Command                                                                                    | Result                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                        | Exit 0; all TypeScript projects and Worker bindings passed.                                                                                                           |
| `npm run lint`                                                                             | Exit 1; ESLint passed, Prettier reported 271 existing formatting files. All changed/new files pass a separate Prettier check.                                         |
| `npm test`                                                                                 | Exit 1 during config loading; private `content-private/imports/rdi1/pack.json` is missing.                                                                            |
| `npm run build`                                                                            | Exit 0; restored default production build after browser tests; generated config has `DEV_CARD_SELECTION: false`.                                                      |
| `npm run test:e2e`                                                                         | Exit 1; managed Playwright Chromium is missing, so the standard sequence cannot reach the separate development/private RDI1 projects.                                 |
| `npx vitest run --config .tools/vitest.available.config.ts`                                | Exit 0; 1,153 tests across 81 files. Supplemental config excludes suites requiring absent private RDI1 input and includes the new actual Workers development project. |
| Targeted engine/client/development Workers/security suites through the supplemental config | Exit 0; all 16 new tests passed after final UI changes.                                                                                                               |
| `npx vitest run --config .tools/vitest.dev-coverage.config.ts --coverage`                  | Exit 0; nine engine tests; new card-selection module has 100% statement, branch, function and line coverage.                                                          |
| `npx playwright test --config .tools/playwright.chrome.config.ts`                          | Exit 0; 24 original fixture journeys passed in installed Chrome.                                                                                                      |
| `npx playwright test --config .tools/playwright.dev.chrome.config.ts`                      | Exit 0; new development journey passed, including bilingual keyboard selection, mobile ordering and reconnect.                                                        |
| `npm run dev:fixture:cards`                                                                | Vite started successfully on loopback; smoke-test launcher stopped afterward.                                                                                         |
| `git diff --check`                                                                         | Exit 0.                                                                                                                                                               |

Diff review found no debug logging, secrets, private source data or machine-specific paths added. The sample seed and official/private source inputs are unchanged. The feature is usable locally; the complete production acceptance gate remains blocked by the setup issues above. No deployment or subsequent upgrade step was started.
