# D1 database through step 12

The Worker binds local D1 as `env.DB`. Only server repositories access it; React and the pure engine have no D1 dependency. All repository inputs and returned JSON pass runtime schemas, and SQL values use bound parameters. There are no content or history HTTP endpoints yet.

## Local setup and inspection

After `npm ci`, run:

```sh
npm run db:migrate
npm run db:seed
```

Both commands explicitly target local storage. They require no Cloudflare account. Migration bookkeeping makes repeated `db:migrate` calls skip applied files. The sample seed creates and publishes `content_sample_v1`; repeating it skips the published pack. It adds missing rows to an existing draft rather than overwriting rows. Use it on an empty database for the canonical fixture. Local SQLite files and migration bookkeeping live under ignored `.wrangler/` storage.

Inspect the local data with:

```sh
npx wrangler d1 execute DB --local --command "SELECT id, name, published_at FROM content_versions;"
npx wrangler d1 execute DB --local --command "SELECT COUNT(*) AS definitions FROM cards;"
npx wrangler d1 execute DB --local --command "SELECT deck_id, SUM(quantity) AS copies FROM deck_cards GROUP BY deck_id ORDER BY deck_id;"
```

The seed has one published version, four characters, ten definitions, six decks, and twenty-eight deck/card associations. Each character deck contains seven copies of six definitions, the Inn has six copies of three definitions, and the token side deck has three copies of one definition. The existing browser health screen remains the visual check; this step adds storage without a content browser.

`wrangler.jsonc` uses a zero UUID placeholder for local development. Before remote deployment, provision D1, replace `database_id`, and apply the migrations remotely in a later deployment step. Do not use the placeholder for deployment. No remote database is created by this step.

## Tables and keys

| Table              | Key and responsibility                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `content_versions` | Version ID; creation and publication timestamps                                                                                 |
| `products`         | `(content_version_id, id)`; unique slug per version                                                                             |
| `characters`       | Version-scoped ID; same-version product FK; rules/resources JSON                                                                |
| `decks`            | Version-scoped ID; optional same-version character FK; character, Inn Drink, or special type                                    |
| `cards`            | Version-scoped definition ID; optional same-version character FK; unique slug; DSL, custom params, and complete definition JSON |
| `deck_cards`       | `(content_version_id, deck_id, card_id)`; same-version FKs and quantity 1–64                                                    |
| `rule_modules`     | Version-scoped ID and unique rule key; rules JSON                                                                               |
| `assets`           | Version-scoped ID; typed owner, relative storage key, and explicit license status                                               |
| `matches`          | Match ID; published content version FK, unsigned 32-bit RNG seed, lifecycle and safe state version                              |
| `match_players`    | `(match_id, player_id)`; unique seat per match; composite FKs enforce the match's version                                       |
| `match_events`     | `(match_id, sequence)`; globally unique event ID and unique `(match_id, state_version, event_index)`                            |
| `match_snapshots`  | `(match_id, sequence)`; state version and internal snapshot JSON                                                                |

All tables use SQLite `STRICT`. Relational FKs restrict deletes instead of silently cascading history or content. Polymorphic asset owner triggers implement the equivalent of an FK for products, characters, decks, cards, and rule modules, including protection against deleting or renaming a referenced owner. Indexes support character/deck loading, asset lookup, room match history, event command lookup, and snapshot versions.

JSON columns require valid JSON of the expected outer shape. Card columns must agree with the complete definition's ID, name, type, character owner, and DSL; the complete JSON preserves reaction, Drink, origin, and side-deck metadata. Repository schemas validate the full DSL and allowlisted custom params. Event and snapshot columns must agree with JSON identity/version metadata and the match's room. JSON is data; executable JavaScript is never accepted as a card effect.

## Publication and version locking

`D1ContentRepository.saveDraft` validates the whole graph and inserts it in one atomic D1 batch. `publishVersion` publishes an existing draft once. Reads for play return only published decks/characters; `getVersion` can inspect draft metadata. Database triggers prohibit inserting, updating, or deleting published content and changing or deleting published version metadata.

A new edition uses a new version ID and may reuse product, character, deck, and definition IDs. Composite keys/FKs prevent editions from mixing. `D1MatchRepository.create` atomically inserts a match and its two to four players, using a published version. That version, RNG seed, room, and match ID are locked against updates. Later editions cannot change an existing match's definitions. Match state versions can advance but cannot decrease.

## Repositories and history contracts

Interfaces are in `worker/repositories/contracts.ts`; D1 implementations are in `content.ts`, `matches.ts`, and `events.ts`. `loadCharacter` returns the version, product, character rules, all owned decks with definitions/quantities, version rule modules, and relevant asset metadata. Load the shared Inn separately with `loadDeck`. Definitions are not expanded into runtime card instances here.

`D1EventRepository.append` validates a nonempty batch of up to 100 internal events and writes it atomically. Events cannot be updated or deleted. Insert guards also reject SQLite replacement writes that could otherwise bypass delete triggers, for both events and published version metadata. `list` pages in increasing sequence order, with a maximum of 1,000 rows. Sequences start at one and are unique per match; two different matches can use the same sequence. The authoritative room assigns sequences/versions, enforces command idempotency and ensures contiguous ordering through its outbox/replay repository. This repository does not execute commands or advance match state.

Snapshots accept sequence zero and later sequences, a matching state version, a schema-versioned envelope, and nested JSON. `getLatestSnapshot` selects the greatest sequence. Full engine-state validation, replay and reconnect are implemented; retention and administrative backup/recovery remain post-MVP work. Events and snapshots can contain hidden hands, deck order, and RNG data; they are server-only and must go through the projection layer before any future delivery to clients.

## Verification

Step 09 adds three tables: `match_manifests` pins the complete validated setup/content; `match_commands` stores immutable accepted command/event batches with contiguous event ranges and unique command/state versions; `match_results` stores winner IDs, public player results, end time and final sequence/version once. There are fifteen application tables in total. `D1ReplayRepository` writes these records together with events, snapshots and match advancement in one transaction, validates command causation and supports latest-snapshot or full-history recovery. The room now assigns strictly increasing sequences and drains its durable outbox before acknowledging. See [persistence and replay](persistence-replay.md) for the current recovery strategy and visual checks.

The Workers project in `vitest.config.ts` reads SQL via `readD1Migrations`, injects it as test-only bindings, resets local test storage, and applies it with `cloudflare:test`'s `applyD1Migrations`. Integration tests exercise actual D1 SQL, transactions, FKs, uniqueness, JSON, publication triggers, migration reapplication, seed parity, and repositories. These tests use isolated storage and never reset the CLI development database.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:coverage`. Browser regression checks remain available through `npm run test:e2e`. See [the content format](content-format.md) for samples and JSON private imports.
