import { DawnCombat } from "./dawn-combat.js";

/** Human-readable names for token dispositions. */
const DISPOSITION_LABELS: Record<number, string> = {
  [1]:  "Friendly",   // CONST.TOKEN_DISPOSITIONS.FRIENDLY
  [-1]: "Hostile",    // CONST.TOKEN_DISPOSITIONS.HOSTILE
  [0]:  "Neutral",    // CONST.TOKEN_DISPOSITIONS.NEUTRAL
  [-2]: "Secret",     // CONST.TOKEN_DISPOSITIONS.SECRET
};

/**
 * Custom CombatTracker sidebar panel for the Dawn system.
 *
 * Replaces the turn-order list with Dawn's faction-interleaved activation
 * display:
 *   1. Activation log (tokens that have already acted this round)
 *   2. Currently acting token + End Turn button
 *   3. "Up Next" candidates (click to begin their activation)
 *   4. All other tokens with activations remaining, grouped by disposition
 *
 * Navigation buttons (Rewind / End Turn / Fast Forward) live in the footer.
 */
export class DawnCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {

  static override DEFAULT_OPTIONS = {
    actions: {
      startActivation: DawnCombatTracker._onStartActivation,
      endActivation:   DawnCombatTracker._onEndActivation,
      rewind:          DawnCombatTracker._onRewind,
      fastForward:     DawnCombatTracker._onFastForward,
      startEncounter:  DawnCombatTracker._onStartEncounter,
    },
  };

  static override PARTS = {
    header: {
      // Keep the parent's header (combat cycle, settings).
      template: "templates/sidebar/tabs/combat/header.hbs",
    },
    tracker: {
      template: "systems/dawn-system/templates/combat/tracker.hbs",
      // Use a specific CSS class for the scrollable region so the footer
      // control row stays fixed.
      scrollable: [".dawn-tracker-scroll"],
    },
    footer: {
      template: "systems/dawn-system/templates/combat/footer.hbs",
    },
  };

  // ──────────────────────────────────────────────────────────
  //  Context preparation
  // ──────────────────────────────────────────────────────────

  /**
   * Adds `canEndTurn` and `round` to the combat context used by the footer.
   */
  protected override async _prepareCombatContext(context: object, options: object): Promise<void> {
    await super._prepareCombatContext(context, options);
    const combat = this.viewed as DawnCombat | null;
    const ctx = context as Record<string, unknown>;
    // Set these on the combat context so the footer part can access them.
    ctx.hasCombat  = combat !== null;
    ctx.started    = combat?.started ?? false;
    ctx.canEndTurn = combat?.getCurrentlyActing() !== null;
    ctx.round      = combat?.round ?? 0;
  }

  /**
   * Replaces the standard initiative-list tracker context with Dawn's
   * activation-based context.
   */
  protected override async _prepareTrackerContext(context: object, options: object): Promise<void> {
    const combat = this.viewed as DawnCombat | null;
    const ctx = context as Record<string, unknown>;

    ctx.hasCombat    = combat !== null;
    ctx.round        = combat?.round ?? 0;
    ctx.canEndTurn   = false;
    ctx.activationLog  = [];
    ctx.currentlyActing = null;
    ctx.upNext         = [];
    ctx.remaining      = [];

    if (!combat) return;

    /** Minimal context object for a single combatant. */
    const mapCombatant = async (c: foundry.documents.Combatant) => ({
      id:   c.id ?? "",
      name: (c as any).name as string ?? "",
      img:  await (this as any)._getCombatantThumbnail(c) as string,
    });

    const logCombatants = combat.getActivationLog();
    const currentlyActing = combat.getCurrentlyActing();
    const upNext = combat.upNextCandidates();
    const remaining = combat.remainingByDisposition();

    ctx.activationLog   = await Promise.all(logCombatants.map(mapCombatant));
    ctx.currentlyActing = currentlyActing ? await mapCombatant(currentlyActing) : null;
    ctx.upNext          = await Promise.all(upNext.map(mapCombatant));
    ctx.canEndTurn      = currentlyActing !== null;

    ctx.remaining = await Promise.all(
      Array.from(remaining.entries()).map(async ([disp, combatants]) => ({
        disposition: disp,
        label: DISPOSITION_LABELS[disp] ?? `Disposition ${disp}`,
        combatants: await Promise.all(combatants.map(mapCombatant)),
      }))
    );
  }

  // ──────────────────────────────────────────────────────────
  //  Action handlers  (Features 1.3 + 1.4)
  // ──────────────────────────────────────────────────────────

  /**
   * Click a combatant in the "Up Next" list → begin their activation.
   */
  static async _onStartActivation(
    this: DawnCombatTracker,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const combatantId =
      (target as HTMLElement & { dataset: DOMStringMap }).dataset.combatantId
      ?? target.closest<HTMLElement>("[data-combatant-id]")?.dataset.combatantId;
    if (!combatantId) return;
    const combat = this.viewed as DawnCombat | null;
    await combat?.startActivation(combatantId);
  }

  /** End the currently acting combatant's turn. */
  static async _onEndActivation(
    this: DawnCombatTracker,
    _event: Event,
    _target: HTMLElement,
  ): Promise<void> {
    const combat = this.viewed as DawnCombat | null;
    await combat?.endActivation();
  }

  /** Rewind to the start of the previous round. */
  static async _onRewind(
    this: DawnCombatTracker,
    _event: Event,
    _target: HTMLElement,
  ): Promise<void> {
    const combat = this.viewed as DawnCombat | null;
    await combat?.rewind();
  }

  /** Skip remaining activations and advance to the next round. */
  static async _onFastForward(
    this: DawnCombatTracker,
    _event: Event,
    _target: HTMLElement,
  ): Promise<void> {
    const combat = this.viewed as DawnCombat | null;
    if (!combat) return;
    // nextRound() fires _onStartRound, which clears activation flags.
    await (combat as any).nextRound();
  }

  /** Begin the encounter, advancing to round 1. */
  static async _onStartEncounter(
    this: DawnCombatTracker,
    _event: Event,
    _target: HTMLElement,
  ): Promise<void> {
    const combat = this.viewed as DawnCombat | null;
    if (!combat) return;
    await (combat as any).nextRound();
  }
}
