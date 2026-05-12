// This file ensures Foundry VTT V14 global type declarations are included by both
// tsc and the rollup TypeScript plugin. The reference paths resolve to the
// Foundry source at ~/Apps/V14/foundry/.
/// <reference path="../../../Apps/V14/foundry/client/global.d.mts" />
/// <reference path="../../../Apps/V14/foundry/common/global.d.mts" />

// ---------------------------------------------------------------------------
// Supplement the Foundry global type stubs with members that are present in
// the V14 source but not yet declared in the generated .d.mts files.
// ---------------------------------------------------------------------------

declare namespace foundry {
  // ── Utils ─────────────────────────────────────────────────────────────────

  namespace utils {
    /** Escape HTML special characters (&, <, >, ", ') for safe embedding in HTML. */
    function escapeHTML(value: string | any): string;
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  namespace documents {
    /** Client-side Combat document. Runtime path: foundry.documents.Combat */
    class Combat {
      id: string | null;
      round: number;
      turn: number | null;
      turns: foundry.documents.Combatant[];
      combatants: Collection<foundry.documents.Combatant>;
      flags: Record<string, Record<string, unknown>>;
      active: boolean;
      readonly started: boolean;
      readonly combatant: foundry.documents.Combatant | null;
      readonly isView: boolean;
      update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<this>;
      nextTurn(): Promise<this>;
      previousTurn(): Promise<this>;
      nextRound(): Promise<this>;
      previousRound(): Promise<this>;
      protected _onStartRound(context: unknown): Promise<void>;
      _onUpdate(changed: object, options: object, userId: string): void;
    }

    /** Client-side Combatant document. Runtime path: foundry.documents.Combatant */
    class Combatant {
      id: string | null;
      name: string;
      img: string;
      hidden: boolean;
      defeated: boolean;
      initiative: number | null;
      actor: { type?: string; system: Record<string, unknown> } | null;
      token: { disposition: number; movementHistory: unknown[] } | null;
      _videoSrc: string | null;
      resource: unknown;
      readonly combat: foundry.documents.Combat | null;
      readonly isDefeated: boolean;
      readonly isOwner: boolean;
      readonly permission: number;
      readonly visible: boolean;
    }
  }

  // ── Applications ──────────────────────────────────────────────────────────

  namespace applications {
    namespace sidebar {
      namespace tabs {
        /** The CombatTracker sidebar panel. Runtime path: foundry.applications.sidebar.tabs.CombatTracker */
        class CombatTracker {
          /** The currently displayed Combat, or null. */
          viewed: foundry.documents.Combat | null;
          /** The element rendered by this application. */
          readonly element: HTMLElement;
          /** True when this is a popout copy. */
          readonly isPopout: boolean;
          render(options?: Record<string, unknown>): unknown;
          protected _prepareCombatContext(context: object, options: object): Promise<void>;
          protected _prepareTrackerContext(context: object, options: object): Promise<void>;
          protected _getCombatantThumbnail(combatant: foundry.documents.Combatant): Promise<string>;
          static DEFAULT_OPTIONS: Record<string, unknown>;
          static PARTS: Record<string, unknown>;
        }
      }
    }
  }
}

// ── CONFIG extensions ──────────────────────────────────────────────────────
// CONFIG is typed as a namespace alias for the config.mjs module exports.
// We extend globalThis to add the missing Combat and ui entries so that
// CONFIG.Combat and CONFIG.ui are typed without casts in system code.

declare global {
  namespace globalThis {
    namespace CONFIG {
      /** CONFIG.Combat — the combat configuration block. */
      const Combat: {
        documentClass: typeof foundry.Combat;
        dataModels: Record<string, unknown>;
        initiative: { formula: string | null; decimals: number };
      };

      /** CONFIG.ui — maps sidebar tab names to their constructor classes. */
      const ui: Record<string, new () => unknown>;
    }
  }
}
