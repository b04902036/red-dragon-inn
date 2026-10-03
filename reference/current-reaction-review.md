# Current reaction-engine review

Based on the repository state after Step 17.

## What is already good

- resolution stack exists
- nested responses exist
- pass priority exists
- Ignore and Negate operations exist
- Anytime cards can currently be inserted outside normal action flow
- response state survives serialization/reconnect
- attention/chime infrastructure already exists

## Problems that must be fixed before real RDI 1/2 cards

### 1. Sometimes legality is too broad

Current client/server behavior largely treats any `SOMETIMES` card as playable whenever a response window exists.

Only a small subset of conditions (notably Ignore/affected-player behavior) is currently validated specially.

Real RDI cards need explicit trigger predicates.

### 2. Response eligibility is not derived from private legal cards

Current response windows include living players even if they have no relevant response card.

For the digital implementation:

- players with no legal response should auto-skip
- hidden hand contents must not be leaked publicly
- the server must privately determine legal response cards

### 3. Initial response order is wrong

Official timing says response opportunities begin with the player who played/revealed the source card, then continue in turn order.

Current helper order starts after the source actor.

### 4. Re-evaluation after a response needs correction

After a response resolves, the original source must be re-evaluated and players get another opportunity to respond in the original timing order.

Do not simply continue after the responder.

### 5. No authoritative timer

There is no response deadline or automatic pass.

### 6. No guaranteed Anytime grace before phase end

Several commands immediately advance the phase.

### 7. Playability is partly a client heuristic

`cardAction(...)` in the client currently infers legality.

For the real cards, the authoritative server must send each player their own legal plays.
