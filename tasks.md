Proceed serially, one feature at a time.

- [ ] Feature 1: Combat Tracker

  Context:
  - Adversary activation limit = `actor.system.gates.value` (already in the data model).
  - Character activation limit = 1 per round.
  - Fodder and Terrain activation limit = 0 (never activate).
  - Faction cycle order is always FRIENDLY → HOSTILE → NEUTRAL (by token disposition), skipping any disposition with no remaining activations.
  - Friendly combatants may never take a second activation in the same round, even if the cycle would return to them.
  - Custom state lives in `combat.flags["dawn-system"]`: `activationLog` (ordered combatant-ID array), `currentlyActing` (combatant ID | null), `activationsUsed` (Record<combatantId, number>). Foundry's `combat.round` and `combat.turn` fields are still incremented for hook/ActiveEffect compatibility, but the tracker ignores `turn` ordering.

  - [ ] Feature 1.1: Custom Combat subclass — activation state

    Create `src/combat/dawn-combat.ts` subclassing `Combat`. Register it as `CONFIG.Combat.documentClass` in the `init` hook.

    Add the following methods (no UI yet — data layer only):
    - `activationLimit(combatant)` → `number`: returns 0 for fodder/terrain actor types, `actor.system.gates.value` for adversary, 1 for character.
    - `getActivationsUsed(combatantId)` → `number`: reads `flags["dawn-system"].activationsUsed[id] ?? 0`.
    - `getActivationLog()` → `Combatant[]`: reads `flags["dawn-system"].activationLog` and resolves to combatants.
    - `getCurrentlyActing()` → `Combatant | null`.
    - `async startActivation(combatantId)`: sets `currentlyActing`, appends to `activationLog`, increments `activationsUsed[id]`, calls `combat.update({ turn: ... })` so Foundry's own hooks fire correctly.
    - `async endActivation()`: clears `currentlyActing`, calls `nextTurn()` internally to advance Foundry's turn pointer.
    - `async rewind()`: calls `previousRound()`, then clears all activation flags.
    - Override `_onStartRound()` to wipe activation flags at the start of each new round.

  - [ ] Feature 1.2: Faction interleaving — "up next" logic

    Add the following pure-computation methods to `DawnCombat` (no network calls):
    - `activatableCombatants()` → `Combatant[]`: all combatants whose actor type is not fodder or terrain.
    - `dispositionCycleOrder()` → `number[]`: unique token dispositions present among activatable combatants, sorted FRIENDLY (1) → HOSTILE (−1) → NEUTRAL (0).
    - `nextDisposition()` → `number | null`: disposition of the faction that should act next. Look at the last entry in `activationLog`; advance one step in `dispositionCycleOrder()`. Skip any disposition that has no combatants with activations remaining. Return `null` when every combatant has exhausted their activations (round over).
    - `upNextCandidates()` → `Combatant[]`: combatants whose disposition equals `nextDisposition()` and who have activations remaining (respecting the friendly-once rule).
    - `remainingByDisposition()` → `Map<number, Combatant[]>`: every other combatant that has activations remaining, grouped by disposition, excluding the up-next disposition and excluding anyone with no activations left.

  - [ ] Feature 1.3: Custom Combat Tracker — read-only display

    Create `src/combat/dawn-combat-tracker.ts` subclassing `CombatTracker`. Register it as `CONFIG.ui.combat` in the `init` hook.

    Override `_prepareTrackerContext()` to return a context object with:
    - `activationLog`: array of `{ name, img, id }` entries in activation order.
    - `currentlyActing`: `{ name, img, id } | null`.
    - `upNext`: array of `{ name, img, id }` from `upNextCandidates()`.
    - `remaining`: array of `{ disposition, label, combatants: { name, img, id }[] }` from `remainingByDisposition()`.
    - `canEndTurn`: boolean (`currentlyActing !== null`).
    - `round`: `combat.round`.

    Create `templates/combat/tracker.hbs` with four sections:
    1. Activated list (top).
    2. Currently acting combatant + "End Turn" button (disabled when `canEndTurn` is false).
    3. "Up Next" candidate list (clicking a candidate will later trigger activation).
    4. Remaining combatants grouped by disposition.
    5. Footer row: Rewind | End Turn | Fast Forward buttons.

    Re-render the tracker whenever `combat.flags["dawn-system"]` changes by hooking `updateCombat`.

  - [ ] Feature 1.4: Interactive controls

    Wire up action handlers on `DawnCombatTracker`:
    - Clicking an "Up Next" candidate calls `combat.startActivation(combatantId)`.
    - "End Turn" button calls `combat.endActivation()`.
    - "Rewind" button calls `combat.rewind()` (beginning of previous round; disabled in round 0).
    - "Fast Forward" button calls `combat.nextRound()` and clears activation flags (skips remaining activations in the current round).
    - After each action, re-render the tracker.

- [ ] Feature 2: Grid

The grid is square, and the distance between squares is manhattan distance. The distance formula should be 1.

- [ ] Feature 3: Unstructured character sheet

TODO

- [ ] Feature 4: action buttons

Cast, 