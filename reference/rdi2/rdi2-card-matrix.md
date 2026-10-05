# RDI2 mechanics-equivalent matrix

This is a **candidate source matrix**, not yet source-locked. Step 24A must verify every row independently.

| Mechanic | Type | Dimli | Eve | Fleck | Gog |
|---|---|---:|---:|---:|---:|
| `gambling_start_or_control` — Join the Game | GAMBLING | 6 | 6 | 6 | 6 |
| `gambling_raise_one` — Raise the Stakes | GAMBLING | 2 | 2 | 2 | 2 |
| `gambling_winning_hand` — Strong Hand | GAMBLING | 2 | 2 | 2 | 2 |
| `cheat_take_control` — Under-the-Table Trick | CHEATING | 0 | 3 | 4 | 0 |
| `cheat_control_and_eject` — Rig the Table | CHEATING | 0 | 1 | 1 | 0 |
| `anti_cheat_win_round` — Catch the Cheat | SOMETIMES | 0 | 0 | 0 | 1 |
| `dump_gambling_pot_to_inn` — The House Takes the Pot | SOMETIMES | 1 | 1 | 1 | 1 |
| `restart_gambling_round` — Run It Back | SOMETIMES | 1 | 0 | 0 | 0 |
| `substitute_payment_from_inn` — Use the Inn's Gold | SOMETIMES | 2 | 0 | 2 | 2 |
| `illusionary_payment` — Illusory Payment | SOMETIMES | 0 | 2 | 0 | 0 |
| `take_one_from_pot` — Palm a Coin | SOMETIMES | 0 | 1 | 0 | 0 |
| `avoid_ante_leave` — Sit This One Out | SOMETIMES | 2 | 0 | 1 | 2 |
| `avoid_ante_leave_or_ignore_drink` — Leave or Refuse the Drink | SOMETIMES | 1 | 1 | 1 | 1 |
| `ignore_card_all_stats` — Disbelieve the Effect | SOMETIMES | 0 | 2 | 0 | 1 |
| `ignore_card_fortitude` — Brace Against the Hit | SOMETIMES | 1 | 0 | 0 | 2 |
| `negate_sometimes_counter` — Hard No | SOMETIMES | 1 | 1 | 1 | 1 |
| `ignore_drink` — Refuse the Drink | SOMETIMES | 2 | 2 | 2 | 2 |
| `order_two_extra_drinks_paid` — Order Two More | SOMETIMES | 2 | 2 | 0 | 2 |
| `order_two_extra_drinks_free_or_waive_refill` — Pay With a Song | SOMETIMES | 0 | 0 | 2 | 0 |
| `all_players_drink_from_inn` — Toast the Whole Table | ACTION | 0 | 0 | 1 | 0 |
| `force_extra_drink_during_other_drink_phase` — Drink One More | SOMETIMES | 1 | 0 | 0 | 2 |
| `pass_own_drink` — Pass the Mug | SOMETIMES | 2 | 0 | 0 | 0 |
| `split_own_drink` — Share the Mug | SOMETIMES | 1 | 0 | 2 | 0 |
| `alcohol_to_fortitude` — Turn Spirits Into Courage | SOMETIMES | 1 | 0 | 0 | 0 |
| `add_two_alcohol_to_drink` — Spike the Drink | SOMETIMES | 2 | 0 | 0 | 0 |
| `replace_drink_with_four_alcohol` — Make It Dragonfire | SOMETIMES | 0 | 1 | 0 | 0 |
| `negate_drink_change_card` — Stop Messing With Drinks | SOMETIMES | 1 | 1 | 1 | 1 |
| `all_lose_one_alcohol_collect_one_each_other` — Sad Song | ACTION | 0 | 0 | 1 | 0 |
| `give_two_alcohol` — Mesmerizing Suggestion | ACTION | 0 | 2 | 0 | 0 |
| `damage_one` — Light Hit | ACTION | 1 | 2 | 1 | 0 |
| `damage_two` — Solid Hit | ACTION | 5 | 0 | 2 | 5 |
| `damage_three` — Real Fire | ACTION | 0 | 2 | 0 | 0 |
| `damage_three_pay_inn_one` — Reckless Smash | ACTION | 0 | 0 | 0 | 1 |
| `damage_four` — Huge Smash | ACTION | 0 | 0 | 0 | 1 |
| `damage_all_others_one` — Everybody Gets Hit | ACTION | 0 | 0 | 0 | 1 |
| `rowdy_song` — Rowdy Drinking Song | ACTION | 0 | 0 | 2 | 0 |
| `hit_back_two_after_loss` — Hit Back | SOMETIMES | 1 | 0 | 1 | 1 |
| `share_pain` — Share the Pain | SOMETIMES | 0 | 1 | 0 | 0 |
| `redirect_fortitude_loss` — Redirect the Hit | SOMETIMES | 0 | 1 | 0 | 0 |
| `gain_two_fortitude` — Second Wind | ANYTIME | 0 | 0 | 1 | 1 |
| `collect_one_from_each_other` — Impress the Table | ACTION | 1 | 1 | 1 | 1 |
| `take_one_gold` — Pocket One Coin | ACTION | 0 | 2 | 0 | 0 |
| `take_two_gold` — Pocket Two Coins | ACTION | 0 | 0 | 1 | 0 |
| `tip_wench` — Tip the Wench | ANYTIME | 1 | 1 | 1 | 1 |

**Totals:** Dimli 40, Eve 40, Fleck 40, Gog 40.

A correct total is **not** evidence that an effect is correct. Step 24A must inspect type, numeric value, target, timing and restrictions for every row.
