/**
 * Flag data stored on the Combat document by the Dawn system.
 */
interface DawnCombatFlags {
  /** Ordered list of combatant IDs, in the order they activated this round. */
  activationLog: string[];
  /** The ID of the combatant currently taking their turn, or null. */
  currentlyActing: string | null;
  /** Map of combatant ID → number of activations used this round. */
  activationsUsed: Record<string, number>;
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

  /** Read the raw Dawn flags from this combat, providing safe defaults. */
  private _getDawnFlags(): DawnCombatFlags {
    const flags = ((this as any).flags?.["dawn-system"] ?? {}) as Partial<DawnCombatFlags>;
    return {
      activationLog:    flags.activationLog    ?? [],
      currentlyActing:  flags.currentlyActing  ?? null,
      activationsUsed:  flags.activationsUsed  ?? {},
    };
  }

  /**
   * Returns the maximum number of activations this combatant may take per round.
   * - fodder / terrain → 0 (never activate)
   * - adversary        → gates.value
   * - character        → 1
   */
  activationLimit(combatant: foundry.documents.Combatant): number {
    const actor = (combatant as any).actor as (Record<string, unknown> & { type?: string }) | null;
    const type = actor?.type;
    if (type === "fodder" || type === "terrain") return 0;
    if (type === "adversary") {
      return Number((actor?.system as any)?.gates?.value ?? 0);
    }
    return 1;
  }

  /** How many activations has this combatant already used this round? */
  getActivationsUsed(combatantId: string): number {
    return this._getDawnFlags().activationsUsed[combatantId] ?? 0;
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
   * Begin a combatant's activation.
   * Updates flags (log, currentlyActing, activationsUsed) and advances
   * Foundry's `turn` pointer to the combatant's slot so that turn hooks
   * and sound cues fire correctly.
   */
  async startActivation(combatantId: string): Promise<void> {
    const flags = this._getDawnFlags();
    const used = { ...flags.activationsUsed, [combatantId]: (flags.activationsUsed[combatantId] ?? 0) + 1 };
    const log  = [...flags.activationLog, combatantId];

    // Find this combatant's index in the Foundry turn array.
    const turnIdx = (this as any).turns.findIndex(
      (c: foundry.documents.Combatant) => c.id === combatantId
    );

    await (this as any).update({
      turn: turnIdx >= 0 ? turnIdx : 0,
      "flags.dawn-system.activationLog":   log,
      "flags.dawn-system.currentlyActing": combatantId,
      "flags.dawn-system.activationsUsed": used,
    });
  }

  /**
   * End the currently active combatant's turn.
   * Clears `currentlyActing` in flags.  Dawn manages round advancement
   * explicitly (via the Fast Forward button / `rewind`), so we do NOT call
   * `nextTurn()` here — that would trigger `_onStartRound` and wipe flags
   * when the last combatant in the Foundry turn array ends their activation.
   */
  async endActivation(): Promise<void> {
    await (this as any).update({
      "flags.dawn-system.currentlyActing": null,
    });
  }

  /**
   * Rewind to the start of the previous round.
   * Calls `previousRound()` (which fires the combatRound hook and updates
   * Foundry's round/turn fields) then clears all activation flags so the
   * round starts fresh.
   */
  async rewind(): Promise<void> {
    await (this as any).previousRound();
    await (this as any).update({
      "flags.dawn-system.activationLog":   [],
      "flags.dawn-system.currentlyActing": null,
      "flags.dawn-system.activationsUsed": {},
    });
  }

  /**
   * Override the round-start hook to wipe activation flags when a new round
   * begins via nextRound() / fast-forward.
   */
  protected override async _onStartRound(context: unknown): Promise<void> {
    await super._onStartRound(context);
    await (this as any).update({
      "flags.dawn-system.activationLog":   [],
      "flags.dawn-system.currentlyActing": null,
      "flags.dawn-system.activationsUsed": {},
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
    if ((flagsChanged || turnChanged) && (this as any).isView) {
      (ui.combat as unknown as { render(opts: object): void }).render({ combat: this });
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

    const hasCandidates = (disp: number): boolean =>
      this.activatableCombatants().some(
        c => (c as any).token?.disposition === disp
          && this.getActivationsUsed(c.id!) < this.activationLimit(c)
      );

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
   * Combatants eligible to be chosen for the next activation:
   * those whose disposition matches `nextDisposition()` and who still have
   * activations remaining.
   */
  upNextCandidates(): foundry.documents.Combatant[] {
    const disp = this.nextDisposition();
    if (disp === null) return [];
    return this.activatableCombatants().filter(
      c => (c as any).token?.disposition === disp
        && this.getActivationsUsed(c.id!) < this.activationLimit(c)
    );
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
      if (c.id === actingId) continue;           // shown in "Acting" section
      if (logIds.has(c.id!)) continue;           // shown in "Activated" section
      const disp = (c as any).token?.disposition as number;
      if (disp === upNextDisp) continue;         // shown in "Up Next" section
      if (!result.has(disp)) result.set(disp, []);
      result.get(disp)!.push(c);
    }

    return result;
  }
}
