# Step 17 — Production upgrade integration audit

## Goal

Audit Steps 13–16 together and close regression gaps.

Do not add unrelated features.

## Required scenarios

### Production content

Verify:
- no production runtime import of sample pack/presentation
- production room pins a published content version
- test fixture mode still works
- 76-character catalog metadata coverage
- production completeness report truthfully reports missing/unsupported official content
- if complete owned/licensed content is present, the verifier passes with no unknown effects/special rules

### Traditional Chinese

In one Playwright context choose zh-TW and another en-US.

Verify they can play the same match while seeing different presentation languages.

The authoritative state/event history must be identical regardless of locale.

Verify canonical zh-TW terms:
- 耐力值
- 酒精值
- 金幣
- 暢飲區
- 賭博
- 作弊
- 續杯
- 酒卡事件

### Audio

With audio playback boundary mocked:
- unlock after gesture
- background music starts once
- local action prompt chimes once
- remote prompt does not chime locally
- response priority chimes
- gambling priority chimes
- reconnect same prompt does not chime twice
- audio disabled path remains functional

### Card UX

Verify:
- whole-card discard selection
- deselection
- no action-button bubbling
- hover details
- focus details
- mobile details
- zh-TW card details

## Static audit

Search production code for:
- `/api/content/sample`
- `sampleContentPack`
- `samplePresentation`
- `Start sample match`
- `Sample table`
- `Sample adventurer`
- hardcoded English strings in major UI components
- direct scattered `new Audio(`
- click-only `Read <card>` UI
- nested interactive controls
- unknown/ignored effect handlers

It is acceptable for sample strings/imports to remain under tests, fixture tooling, sample content, and explicit demo-only files.

## Content/IP audit

Confirm:
- no newly scraped complete proprietary card text was committed
- no copyrighted artwork was fetched without authorization
- private content stays ignored
- audio license/provenance file exists
- translation provenance/status is stored

## Required test commands

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run content:verify:production
npm run content:verify:zh-TW
```

If production card data is intentionally absent, `content:verify:production` is expected to fail with a clear report. Record that as the only allowed release blocker; do not mask it.

If user-owned/licensed complete production content is present, Step 17 cannot pass until `content:verify:production` exits zero.

## Coverage review

Inspect uncovered branches for:
- content version pinning
- translation fallback/strict mode
- attention-chime deduplication
- card click bubbling
- hover/focus cleanup

Add meaningful behavioral tests for uncovered critical branches.

## Final report

Create/update `docs/production-upgrade-status.md` with:
- runtime content status
- number of catalog characters
- playable characters
- unique imported cards
- total physical card count
- unsupported mechanics
- zh-TW translation completeness percentage
- audio assets and licenses
- UI interaction changes
- exact test results
- release blockers

Stop after this step.
