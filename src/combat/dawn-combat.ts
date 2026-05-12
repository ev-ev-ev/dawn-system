/**
 * Flag data stored on the Combat document by the Dawn system.
 */
interface DawnCombatFlags {
  /** The round number these flags were last written for. */
  round: number;
  /** Ordered list of combatant IDs, in the order they activated this round.
   * A combatant may appear more than once if they have multiple activations.
   */
  activationLog: string[];
  /** The ID of the combatant currently taking their turn, or null. */
  currentlyActing: string | null;
}

/**
 * Returns the disposition sort priority for the Dawn faction cycle:
 *   FRIENDLY (1) → HOSTILE (-1) → NEUTRAL (0) → SECRET (-2) → others
 */
function dispositionPriority(d: number): number {
  switch (d) {
    case CONST.TOKEN_DISPOSITIONS.FRIENDLY: return 0;
    case CONST.TOKEN_DISPOSITIONS.HOSTILE:  return 1;
    case CONST.TOKEN_DISPOSITIONS.NEUTRAL:  return 2;
    case CONST.TOKEN_DISPOSITIONS.SECRET:   return 3;
    default:                                return 4;
  }
}

/**
 * Custom Combat subclass for the Dawn system.
 *
 * Replaces Foundry's initiative-based turn order with a faction-interleaved
 * activation system.  All custom state lives in `flags["dawn-system"]`.
 * Foundry's `round` and `turn` fields are still advanced so that
 * ActiveEffect hooks and sound cues fire normally.
 */
export class DawnCombat extends foundry.documents.Combat {

  // ──────────────────────────────────────────────────────────
  //  Feature 1.1 — Activation state
  // ──────────────────────────────────────────────────────────

  /** Read the raw Dawn flags from this combat, providing safe defaults.
   * If the stored round stamp doesn't match the current round the flags
   * are treated as empty — this is what resets state each new round
   * without relying on _onStartRound.
   */
  private _getDawnFlags(): DawnCombatFlags {
    const currentRound = (this as any).round as number ?? 0;
    const raw = ((this as any).flags?.["dawn-system"] ?? {}) as Partial<DawnCombatFlags>;
    const stale = (raw.round ?? -1) !== currentRound;
    return {
      round:           currentRound,
      activationLog:   stale ? [] : (raw.activationLog  ?? []),
      currentlyActing: stale ? null : (raw.currentlyActing ?? null),
    };
  }

  /**
   * Returns the maximum number of activations this combatant may take per round.
   * - fodder / terrain → 0 (never activate)
   * - adversary        → number of component items (gatesMax)
   * - character        → 1
   */
  activationLimit(combatant: foundry.documents.Combatant): number {
    const actor = (combatant as any).actor as (Record<string, unknown> & { type?: string; items?: Array<{ type: string }> }) | null;
    const type = actor?.type;
    if (type === "fodder" || type === "terrain") return 0;
    if (type === "adversary") {
      return (actor?.items ?? []).filter((i: { type: string }) => i.type === "component").length;
    }
    return 1;
  }

  /** How many activations has this combatant already used this round?
   * Derived by counting occurrences in activationLog so it automatically
   * resets when the log resets at the start of a new round.
   */
  getActivationsUsed(combatantId: string): number {
    return this._getDawnFlags().activationLog.filter(id => id === combatantId).length;
  }

  /**
   * Ordered list of Combatants that have activated this round,
   * in the order they activated.
   */
  getActivationLog(): foundry.documents.Combatant[] {
    const log = this._getDawnFlags().activationLog;
    return log.flatMap(id => {
      const c = (this as any).combatants.get(id) as foundry.documents.Combatant | undefined;
      return c ? [c] : [];
    });
  }

  /** The Combatant currently taking their turn, or null. */
  getCurrentlyActing(): foundry.documents.Combatant | null {
    const id = this._getDawnFlags().currentlyActing;
    if (!id) return null;
    return ((this as any).combatants.get(id) as foundry.documents.Combatant | undefined) ?? null;
  }

  /**
   * Start the combat encounter.
   *
   * Overrides the default implementation to keep `turn: null` (Dawn manages
   * the turn pointer itself) and fire `combatStart` rather than `combatRound`.
   * This ensures tension resets to 0 on start instead of incrementing.
   */
  async startCombat(): Promise<this> {
    (this as any)._playCombatSound("startEncounter");
    const updateData = { round: 1, turn: null };
    (foundry.helpers.Hooks as any).callAll("combatStart", this, updateData);
    await (this as any).update(updateData);
    await ((foundry as any).documents?.ActiveEffect as { registry?: { refresh(e: string, ctx: object): Promise<void> } } | undefined)
      ?.registry?.refresh("combatStart", { combat: this });
    return this;
  }

  /**
   * Begin a combatant's activation.
   * Updates flags (log, currentlyActing, activationsUsed) and advances
   * Foundry's `turn` pointer to the combatant's slot so that turn hooks
   * and sound cues fire correctly.
   */
  async startActivation(combatantId: string): Promise<void> {
    const flags = this._getDawnFlags();
    const log  = [...flags.activationLog, combatantId];
    const currentRound = (this as any).round as number ?? 0;

    // Find this combatant's index in the Foundry turn array.
    const turnIdx = (this as any).turns.findIndex(
      (c: foundry.documents.Combatant) => c.id === combatantId
    );

    await (this as any).update({
      turn: turnIdx >= 0 ? turnIdx : 0,
      "flags.dawn-system.round":            currentRound,
      "flags.dawn-system.activationLog":   log,
      "flags.dawn-system.currentlyActing": combatantId,
    });

    // Fire turnStart so ActiveEffect durations with expiry:"turnStart" are processed.
    if (game.user?.isGM) {
      await ((foundry as any).documents?.ActiveEffect as { registry?: { refresh(e: string, ctx: object): Promise<void> } } | undefined)
        ?.registry?.refresh("turnStart", {
          round: currentRound,
          turn:  turnIdx >= 0 ? turnIdx : 0,
          skipped: false,
        });
    }
  }

  /**
   * End the currently active combatant's turn.
   * Clears `currentlyActing` in flags.  Dawn manages round advancement
   * explicitly (via the Fast Forward button / `rewind`), so we do NOT call
   * `nextTurn()` here — that would trigger `_onStartRound` and wipe flags
   * when the last combatant in the Foundry turn array ends their activation.
   */
  async endActivation(): Promise<void> {
    const acting = this.getCurrentlyActing();
    const currentRound = (this as any).round as number ?? 0;
    const turnIdx = acting
      ? (this as any).turns.findIndex((c: foundry.documents.Combatant) => c.id === acting.id)
      : -1;

    // Also clear Foundry's `turn` pointer so the canvas token ring disappears.
    await (this as any).update({
      turn: null,
      "flags.dawn-system.round":            currentRound,
      "flags.dawn-system.currentlyActing": null,
    });

    // Fire turnEnd so ActiveEffect durations with expiry:"turnEnd" are processed.
    if (acting && game.user?.isGM) {
      await ((foundry as any).documents?.ActiveEffect as { registry?: { refresh(e: string, ctx: object): Promise<void> } } | undefined)
        ?.registry?.refresh("turnEnd", {
          round: currentRound,
          turn:  turnIdx >= 0 ? turnIdx : 0,
          skipped: false,
        });
    }
  }

  /**
   * Rewind to the start of the previous round.
   * Calls `previousRound()` (which fires the combatRound hook and updates
   * Foundry's round/turn fields) then clears all activation flags so the
   * round starts fresh.
   */
  async rewind(): Promise<void> {
    await (this as any).previousRound();
    const newRound = (this as any).round as number ?? 0;
    await (this as any).update({
      "flags.dawn-system.round":            newRound,
      "flags.dawn-system.activationLog":   [],
      "flags.dawn-system.currentlyActing": null,
    });
  }

  /**
   * Override _onUpdate to re-render the combat tracker whenever our custom
   * flags or the turn pointer change (Foundry only re-renders on active/scene
   * changes by default).
   */
  override _onUpdate(changed: object, options: object, userId: string): void {
    super._onUpdate(changed, options, userId);
    const ch = changed as Record<string, unknown>;
    const flagsChanged = (ch.flags as Record<string, unknown> | undefined)?.["dawn-system"] !== undefined;
    const turnChanged  = "turn" in ch;
    if (flagsChanged || turnChanged) {
      // Guard: only render if the tracker element is currently in the DOM.
      // Foundry already re-renders on combat updates via the updateCombat hook;
      // we only need to force a render for flag-only changes which Foundry ignores.
      const tracker = (ui as any).combat;
      if (flagsChanged && tracker?.element) {
        tracker.render();
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  //  Feature 1.2 — Faction interleaving / "up next" logic
  // ──────────────────────────────────────────────────────────

  /**
   * All combatants that are eligible to activate (not fodder or terrain).
   */
  activatableCombatants(): foundry.documents.Combatant[] {
    return ((this as any).turns as foundry.documents.Combatant[]).filter(c => {
      if (c.isDefeated) return false;
      const type = ((c as any).actor as { type?: string } | null)?.type;
      return type !== "fodder" && type !== "terrain";
    });
  }

  /**
   * The unique token dispositions present among activatable combatants,
   * ordered FRIENDLY → HOSTILE → NEUTRAL → SECRET → others.
   */
  dispositionCycleOrder(): number[] {
    const present = new Set<number>(
      this.activatableCombatants().map(c => (c as any).token?.disposition as number)
    );
    return [...present].sort((a, b) => dispositionPriority(a) - dispositionPriority(b));
  }

  /**
   * Count how many activations each disposition has in the log this round.
   * Used to determine fallback eligibility.
   */
  private _logCountsByDisposition(): Map<number, number> {
    const log = this._getDawnFlags().activationLog;
    const counts = new Map<number, number>();
    for (const id of log) {
      const c = (this as any).combatants.get(id) as foundry.documents.Combatant | undefined;
      if (!c) continue;
      const disp = (c as any).token?.disposition as number;
      if (disp !== undefined) counts.set(disp, (counts.get(disp) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Fallback candidates for a non-Friendly disposition: combatants with
   * activationLimit > 0 whose faction has logged fewer activations than
   * the Friendly faction this round.
   *
   * This lets non-Friendly factions keep interleaving with players even
   * after exhausting their normal per-round activations.
   * Friendly combatants never receive fallback activations.
   */
  private _fallbackCandidates(
    disp: number,
    logCounts: Map<number, number>,
  ): foundry.documents.Combatant[] {
    if (disp === CONST.TOKEN_DISPOSITIONS.FRIENDLY) return [];
    const friendly    = logCounts.get(CONST.TOKEN_DISPOSITIONS.FRIENDLY) ?? 0;
    const factionSeen = logCounts.get(disp) ?? 0;
    if (factionSeen >= friendly) return [];
    return this.activatableCombatants().filter(
      c => (c as any).token?.disposition === disp && this.activationLimit(c) > 0
    );
  }

  /**
   * The disposition that should act next, or null if all activations are
   * exhausted for this round.
   *
   * Algorithm:
   * 1. Look at the last combatant in the activation log to find the
   *    "previous" disposition.
   * 2. Step one position forward in the cycle order.
   * 3. If that disposition has no candidates with activations remaining,
   *    skip to the next.  Repeat until a disposition is found or all are
   *    exhausted (return null).
   */
  nextDisposition(): number | null {
    const cycle = this.dispositionCycleOrder();
    if (cycle.length === 0) return null;

    const logCounts = this._logCountsByDisposition();
    const hasCandidates = (disp: number): boolean => {
      const hasNormal = this.activatableCombatants().some(
        c => (c as any).token?.disposition === disp
          && this.getActivationsUsed(c.id!) < this.activationLimit(c)
      );
      return hasNormal || this._fallbackCandidates(disp, logCounts).length > 0;
    };

    const log = this.getActivationLog();

    if (log.length === 0) {
      // Nothing has activated yet — find the first disposition with candidates.
      for (const d of cycle) {
        if (hasCandidates(d)) return d;
      }
      return null;
    }

    // Find the disposition of the last activator.
    const lastDisp = (log[log.length - 1] as any).token?.disposition as number;
    const startIdx = cycle.indexOf(lastDisp);

    // Walk forward through the cycle (wrapping) until a disposition has
    // candidates, or all are exhausted.
    for (let i = 1; i <= cycle.length; i++) {
      const idx = startIdx === -1
        ? (i - 1) % cycle.length        // lastDisp not in cycle: start from 0
        : (startIdx + i) % cycle.length;
      if (hasCandidates(cycle[idx])) return cycle[idx];
    }

    return null;
  }

  /**
   * Combatants eligible to be chosen for the next activation.
   * Returns normal candidates first; falls back to faction-fallback candidates
   * when the faction is exhausted but has fewer logged activations than
   * the Friendly faction.
   */
  upNextCandidates(): foundry.documents.Combatant[] {
    const disp = this.nextDisposition();
    if (disp === null) return [];
    const normal = this.activatableCombatants().filter(
      c => (c as any).token?.disposition === disp
        && this.getActivationsUsed(c.id!) < this.activationLimit(c)
    );
    if (normal.length > 0) return normal;
    return this._fallbackCandidates(disp, this._logCountsByDisposition());
  }

  /**
   * All combatants that have not yet activated this round and are not in the
   * up-next group, grouped by disposition.
   *
   * Includes combatants with activationLimit === 0 (e.g. adversaries with no
   * gates, fodder, terrain) so the GM can always see the full picture.  They
   * simply won't be clickable to start an activation.
   */
  remainingByDisposition(): Map<number, foundry.documents.Combatant[]> {
    const flags     = this._getDawnFlags();
    const logIds    = new Set(flags.activationLog);
    const actingId  = flags.currentlyActing;
    const upNextDisp = this.nextDisposition();
    const result    = new Map<number, foundry.documents.Combatant[]>();

    for (const c of ((this as any).turns as foundry.documents.Combatant[])) {
      if (c.isDefeated) continue;           // defeated tokens never appear
      if (c.id === actingId) continue;      // shown in "Acting" section
      if (logIds.has(c.id!)) continue;      // shown in "Activated" section
      const disp = (c as any).token?.disposition as number;
      if (disp === upNextDisp) continue;         // shown in "Up Next" section
      if (!result.has(disp)) result.set(disp, []);
      result.get(disp)!.push(c);
    }

    return result;
  }
}
