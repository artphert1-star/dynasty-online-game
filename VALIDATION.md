# Validation of Dynasty v1.3

Rules source: supplied Dynasty Rulebook v1.3. Optional court cards and playtest suggestions are not enabled as core rules.

- 42 engine tests, including 120 complete bot games across 3–6 players.
- One Socket.IO integration test (including leader selection and rejection of a claimed leader): static client, health route, three humans, host permissions, rejection of impersonated reconnect, negotiation, placement, petition response, private views, and reconnect.
- Headless Edge: create room, add bots, negotiate, first-come leader selection, empty envelope, petition, tax, mobile help, all six decision panels, no browser JavaScript errors or horizontal overflow at 390 px.
- Desktop and mobile screenshots visually inspected.

| Rulebook | Engine methods |
| --- | --- |
| 3 dice | rl, contest, respond, resolveRebellion |
| 4 stats and support | stat, hb, beginEnd |
| 5 ranks | seatsFull, petition |
| 7 phases | startEra, beginPlacement, beginTurns, endTurn, finishEra |
| 8.1 public actions | act, familyAction, takeWife, petition |
| 8.2 operations | act, attack, die |
| 8.3 responses | advanceLobby, respond |
| 9 succession | fixFamily, returnHeir, die |
| 10 rebellions | rebel, checkRebellion, resolveRebellion |
| 11 secrets | giveSecret, useSecret, discardOwnSecret |
| 12 scoring | pubScore, finalScore |
| Negotiation and favors | offer, accept, favor |

Limitations: no human balance playtest, persistent storage, deployment, or disconnected-player autopilot. Humans acknowledge arbitrary promises and fulfillment.


Additional v1.3 checks: carryover favor debt, every prestige reward repays debt, negative final prestige scores, net prestige in turn order, d6 rerolls of tied participants only, kidnapping protection through the victim's next turn despite release, recapture extending protection, heir assassination exception, rebellions without paid dice, unavailable adoption not charging, birth restrictions, real matching lobby fulfillment, holder-only confirmation of other promises, explicit deal terms and consent, shared victories, and the 12-card event deck.

The supplied rulebook defaults to random leaders. User-requested first-come leader selection is an intentional setup override; all eight card values remain unchanged. Bots choose only after the humans select.
