# Step 14 — Traditional Chinese localization with terminology enforcement

## Goal

Add complete `zh-TW` presentation support for the UI and for imported game content, while keeping authoritative engine data locale-independent.

Traditional Chinese should be a first-class language, not a collection of inline ternaries.

## Translation research baseline

Read `reference/zh-TW-glossary.md`.

Verified public Traditional Chinese sources support the following core choices:
- The Red Dragon Inn -> 紅龍酒館
- Fortitude -> 耐力值
- Alcohol Content -> 酒精值
- Gold -> 金幣
- Character Deck -> 角色牌庫
- Drink Deck -> 飲料牌庫
- Chaser -> 續杯
- Drink Event -> 酒卡事件
- Gambling -> 賭博
- Cheating -> 作弊
- turn phases use terminology such as 棄牌抽牌、出牌行動、買酒/請客、喝酒

Use the glossary's selected canonical wording consistently.

Do not switch between `耐力`, `毅力`, `Fortitude` in player-facing zh-TW UI unless the English word is intentionally shown as a parenthetical reference.

## UI i18n architecture

Implement a real localization layer for all player-facing UI strings.

At minimum:
- `en-US`
- `zh-TW`

Choose a maintainable typed solution. A library is acceptable, or a small strongly typed internal system is acceptable.

Do not localize:
- protocol discriminators
- DB primary keys
- effect op names
- event types
- engine enums
- replay semantics

Localize only presentation.

## Language selection

Add a language selector in a sensible globally accessible location.

Requirements:
- `zh-TW`
- `en-US`
- persist preference in localStorage
- default:
  - if browser locale starts with `zh-TW`, use zh-TW
  - otherwise default to existing English
- locale change must not reconnect, restart, or mutate the match
- different players in the same room may use different locales

## Localize existing UI

Remove hardcoded English player-facing strings from at least:
- `App.tsx`
- `RoomScreen.tsx`
- `GameTable.tsx`
- `Modal.tsx`
- `room-state.ts` user-visible phase/rejection/log copy
- reconnect/status messages
- response/gambling panels
- target/choice dialogs
- result/winner text
- accessibility labels where user-facing

Use parameterized translations rather than string concatenation where grammar differs.

## Localized content model

Extend presentation/content localization without changing canonical game definitions.

Preferred DB model:
- `content_translations`
  - content_version_id
  - entity_type
  - entity_id
  - field
  - locale
  - text
  - source_kind
  - source_ref nullable
  - status (`VERIFIED`, `COMMUNITY_REFERENCE`, `MACHINE_DRAFT`, `MANUAL_DRAFT`, etc.)

At minimum localize:
- product name
- character name
- card name
- card rules/presentation text
- special mechanic labels
- rule-module display names/summaries where shown

English canonical text remains available as fallback.

## Translation-source priority

For zh-TW:

1. verified official/current Traditional Chinese release terminology where publicly identifiable
2. verified authorized publisher/store material
3. established Traditional Chinese community terminology
4. translate from the user-owned/licensed English content using the glossary
5. never use Simplified Chinese as final zh-TW content

Do not copy an entire proprietary translated card set from a retail/blog website.

If user-owned/licensed English card data is imported, it may be translated for the user's content pack.

## Translation pipeline

Add a tool/command, for example:

```bash
npm run content:translate:zh-TW
npm run content:verify:zh-TW
```

The translation verifier must catch:
- missing zh-TW names/text for production-visible content
- forbidden Simplified-only terminology when a canonical Traditional term exists
- inconsistent core terms
- untranslated UI keys
- placeholder/sample English leaking into production
- English fallback usage in production when translation is marked required
- duplicate/conflicting translations for same content version/entity/field/locale

Provide a report, not just boolean failure.

## Glossary enforcement

Use the provided glossary as machine-readable or convert it into a source file.

At minimum enforce canonical zh-TW output for:
- 紅龍酒館
- 耐力值
- 酒精值
- 金幣
- 手牌
- 牌庫
- 棄牌堆
- 角色牌庫
- 飲料牌庫
- 暢飲區
- 棄牌抽牌階段
- 出牌行動階段
- 請客階段
- 喝酒階段
- 賭博
- 作弊
- 跳過
- 主導權
- 續杯
- 酒卡事件
- 醉倒
- 淘汰
- 回應時機

Keep `Sometimes` and `Anytime` as canonical printed keywords unless a verified current Traditional Chinese edition provides an official replacement. In zh-TW help text they may be explained as:
- `Sometimes（特定時機）`
- `Anytime（任何時機）`

## Character names

Known current Traditional Chinese core-set naming should be used when verified.

For characters without verified Traditional Chinese naming:
- keep canonical English name visible as fallback
- allow a zh-TW transliteration/manual translation
- mark its translation status
- do not pretend an unverified transliteration is official

## Tests — mandatory

1. default English still renders
2. zh-TW browser locale selects zh-TW on first visit
3. explicit locale choice persists
4. changing locale does not send gameplay commands
5. two browser contexts can use different locales in same room
6. all major landing/lobby/game UI strings render in zh-TW
7. phase labels render using glossary wording
8. Fortitude/Alcohol/Gold are consistently 耐力值/酒精值/金幣
9. Chaser/Drink Event/Gambling/Cheating use canonical glossary output
10. server protocol enums are unchanged by locale
11. replays are locale-independent
12. presentation endpoint returns zh-TW localized content when requested
13. missing translation falls back to canonical English in non-strict/dev mode
14. production zh-TW completeness check catches missing required translation
15. translation source/status round-trips through D1
16. parameterized winner/reconnect/response text works in both locales
17. accessibility names are localized
18. no Simplified Chinese test fixtures appear in final zh-TW UI
19. glossary consistency validator catches intentional bad fixtures
20. E2E covers a full turn in zh-TW

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run content:verify:zh-TW
```

Do not begin Step 15.
