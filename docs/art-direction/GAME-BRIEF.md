# Who Stole the Moon? — Game Brief

**Genre:** Cozy fantasy social deduction · exploration · light multiplayer tasks.
**Players:** Up to 8 real players in one shared village (no bots, no room codes for the first experience).
**Session:** One shared world + one shared active round. Late joiners sync full state.

## Setting
A charming, slightly strange village at blue-hour twilight: crooked cottages,
central fountain, clock tower, tiny library, overgrown garden, village square,
distant observatory on a hill.

## Premise
The moon has disappeared. Eight villagers investigate: explore, find clues,
complete small tasks, discuss, vote, and unmask the culprit before the mystery concludes.

## Tone
Whimsical, mysterious, cozy, playful, occasionally mischievous. Never horror.

## Core loop
1. **Lobby** — join with name + avatar, ready up, begin the night (min 3 villagers).
2. **Exploration (4 min)** — walk the village (WASD/arrows), investigate golden
   glimmers (clues) and green glimmers (tasks). Server validates proximity.
3. **Discussion (2 min)** — compare notes in chat.
4. **Voting (60 s)** — one vote each, no self-votes, no changes.
5. **Results** — culprit reveal, motive, and the reasoning trail. New mystery or
   back to the square.

## Roles
One hidden **culprit**, rest **villagers**. The culprit knows who they are
(`youAreCulprit`); nobody else does. Culprit identity never appears in public
state, payloads, or client source data — enforced by `GameManager.stateFor()`.

## Win condition
Villagers win if the plurality vote names the culprit (ties let the culprit slip away).
