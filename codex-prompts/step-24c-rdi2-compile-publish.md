# Step 24C — Compile, import and publish RDI2 alongside RDI1

## Prerequisites
- Step 24A source lock green
- Step 24B engine gap fully closed
- no unsupported RDI2 mechanic

## Goal

Compile RDI2 into the repository's real ContentPack schema and publish a new immutable content version containing **RDI1 + RDI2**.

Do not overwrite or invalidate the existing RDI1 content version.

## Private outputs

Generate:

```text
content-private/imports/rdi2/pack.json
content-private/imports/rdi2/compile-report.json
```

Add scripts mirroring RDI1:

```bash
npm run content:compile:rdi2
npm run content:verify:rdi2
npm run content:publish:rdi2
npm run content:verify:rdi1-rdi2
```

## RDI2 hard counts

Characters:
- Dimli 40
- Eve 40
- Fleck 40
- Gog 40

Totals:
- RDI2 character physical cards = 160
- RDI2 Drink deck = 30

No no-op/unknown/unsupported card.

## Combined production version

Create a new immutable version, for example:

```text
content_rdi1_rdi2_mechanics_v1
```

It must contain:
- RDI1: Deirdre, Fiona, Gerki, Zot
- RDI2: Dimli, Eve, Fleck, Gog

Existing rooms pinned to the old RDI1-only version remain valid/replayable.

Lobby for the combined version must show exactly 8 playable characters.

## Drink setup

Support explicit setup choices:

```text
RDI1 Drink Deck
RDI2 Drink Deck
RDI1 + RDI2 Bar Deck
```

For the combined Bar Deck use the official rule:
- shuffle selected Drinks into Bar Deck
- active Drink Deck starts with 30
- when it runs out, normal refill payment occurs
- take next 30 from Bar Deck
- after Bar Deck exhaustion, rebuild from discarded Drinks as specified

Do not simply make a permanent active 60-card Drink Deck.

## Translation

Every RDI2 production record requires:
- en-US
- zh-TW
- canonical locale-independent ID

Keep existing glossary:
- 耐力值
- 酒精值
- 金幣
- 暢飲區
- 賭博
- 作弊
- 續杯
- 酒卡事件

Translations in this mechanics pack are implementation translations; do not falsely label an unverified translation as official.

## Provenance

Use accurate provenance.
Do not label the reconstructed source as LICENSED unless the user has actually supplied a license.

## Tests

- deterministic compile
- source hash must match source lock
- every generated ID unique
- 40/40/40/40
- Drink 30/30
- all trigger/effect schemas validate
- dry-run import
- local D1 import/publish
- old RDI1 version still loads
- new combined version loads 8 characters
- no sample fallback
- RDI2-only Drink setup
- combined Bar Deck setup

Run:

```bash
npm run content:verify:rdi2-source
npm run content:compile:rdi2
npm run content:verify:rdi2
npm run content:verify:rdi1-rdi2
npm run content:verify:zh-TW
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

Stop before Step 24D.
