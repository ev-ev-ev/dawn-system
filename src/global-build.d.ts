/**
 * Minimal global declarations for the Foundry V14 runtime.
 * Used only during the Rollup build (tsconfig.build.json).
 * The real types come from Foundry's source at runtime.
 */

declare class BaseActor {
  id: string;
  name: string;
  img: string;
  type: string;
  system: Record<string, unknown>;
  statuses: Set<string>;
  items: Array<BaseItem>;
  activeEffects: Array<{
    update(data: Record<string, unknown>): Promise<void>;
    duration?: { value?: number };
  }>;
  getEmbeddedCollection(name: string): Array<{ id: string; name: string; type: string }>;
  toObject(): { system: Record<string, unknown> };
  update(data: Record<string, unknown>): Promise<void>;
  toggleStatusEffect(statusId: string, options?: { active?: boolean; overlay?: boolean }): Promise<void>;
}

declare class BaseItem {
  id: string;
  name: string;
  type: string;
  system: Record<string, unknown>;
}

declare namespace foundry {
  namespace abstract {
    class TypeDataModel {
      static defineSchema(): Record<string, unknown>;
      prepareBaseData(): void;
    }
  }

  namespace documents {
    class Combat {
      id: string | null;
      round: number;
      turn: number | null;
      turns: foundry.documents.Combatant[];
      combatants: {
        get(id: string): foundry.documents.Combatant | undefined;
        size: number;
        filter(fn: (c: foundry.documents.Combatant) => boolean): foundry.documents.Combatant[];
      };
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

    namespace collections {
      class Actors {
        static registerSheet(scope: string, cls: unknown, options: Record<string, unknown>): void;
      }
      class Items {
        static registerSheet(scope: string, cls: unknown, options: Record<string, unknown>): void;
      }
    }

    class BaseActor {
      id: string;
      name: string;
      img: string;
      type: string;
      system: Record<string, unknown>;
      statuses: Set<string>;
      items: Array<BaseItem>;
      activeEffects: Array<{
        update(data: Record<string, unknown>): Promise<void>;
        duration?: { value?: number };
      }>;
      getEmbeddedCollection(name: string): Array<{ id: string; name: string; type: string }>;
      toObject(): { system: Record<string, unknown> };
      update(data: Record<string, unknown>): Promise<void>;
      toggleStatusEffect(statusId: string, options?: { active?: boolean; overlay?: boolean }): Promise<void>;
    }

    class BaseItem {
      id: string;
      name: string;
      type: string;
      system: Record<string, unknown>;
    }
  }

  namespace data {
    namespace fields {
      class NumberField { constructor(options?: Record<string, unknown>); }
      class StringField { constructor(options?: Record<string, unknown>); }
      class TextField { constructor(options?: Record<string, unknown>); }
      class ArrayField { constructor(options?: Record<string, unknown>); }
      class SchemaField { constructor(options?: Record<string, unknown>); }
      class BooleanField { constructor(options?: Record<string, unknown>); }
      class FlagField { constructor(options?: Record<string, unknown>); }
      class ObjectField { constructor(options?: Record<string, unknown>); }
    }
  }

  namespace helpers {
    namespace Hooks {
      function once(event: string, fn: (...args: unknown[]) => void): void;
      function on(event: string, fn: (...args: unknown[]) => void): void;
    }
  }

  namespace applications {
    namespace api {
      function HandlebarsApplicationMixin<T extends new (...args: unknown[]) => any>(base: T): T;

      class DialogV2 {
        static input(config: {
          window?: { title?: string };
          content?: string;
          ok?: { label?: string; icon?: string };
          rejectClose?: boolean;
        }): Promise<Record<string, unknown> | null>;
        static wait(config: {
          window?: { title?: string };
          content?: string;
          buttons: Array<{
            action: string;
            label: string;
            icon?: string;
            default?: boolean;
            callback?: (event: Event, button: HTMLButtonElement, dialog: DialogV2) => unknown;
          }>;
          submit?: (result: unknown, dialog: DialogV2) => void;
          rejectClose?: boolean;
        }): Promise<unknown>;
        static confirm(config: {
          window?: { title?: string };
          content?: string;
          ok?: { label?: string; icon?: string };
          cancel?: { label?: string; icon?: string } | false;
          rejectClose?: boolean;
        }): Promise<boolean>;
      }
    }

    namespace sidebar {
      namespace tabs {
        class CombatTracker {
          viewed: foundry.documents.Combat | null;
          readonly element: HTMLElement;
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

    namespace sheets {
      class ActorSheetV2 {
        document: BaseActor;
        static DEFAULT_OPTIONS: Record<string, unknown>;
        static PARTS: Record<string, { template: string }>;
        _prepareContext(options: object): Promise<Record<string, unknown>>;
        _preRender(context: object, options: object): Promise<void>;
        _onRender(context: object, options: object): Promise<void>;
      }
      class ItemSheetV2 {
        document: BaseItem;
        static DEFAULT_OPTIONS: Record<string, unknown>;
        static PARTS: Record<string, { template: string }>;
        _prepareContext(options: object): Promise<Record<string, unknown>>;
      }
    }
  }
}

declare class Roll {
  constructor(formula: string);
  evaluate(): Promise<this>;
  get dice(): Array<{
    results: Array<{ result: number; success?: boolean; exploded?: boolean }>;
  }>;
  toAnchor(): HTMLElement;
}

declare class ChatMessage {
  static create(data: {
    content: string;
    speaker?: Record<string, unknown>;
    rolls?: Roll[];
    sound?: string;
    renderHook?: string;
  }): Promise<ChatMessage>;
  static getSpeaker(options?: { actor?: unknown }): Record<string, unknown>;
  getFlag(namespace: string, key: string): unknown;
  setFlag(namespace: string, key: string, value: unknown): Promise<void>;
  element: HTMLElement;
}

declare const game: {
  i18n: { localize(key: string): string };
  settings: {
    get(namespace: string, key: string): number | string | boolean | object | null;
    set(namespace: string, key: string, value: unknown): Promise<void>;
    register(namespace: string, key: string, data: Record<string, unknown>): void;
  };
  user?: {
    id?: string;
    isGM?: boolean;
    isAssistant?: boolean;
    limited?: boolean;
    targets?: Array<{
      id: string;
      scene?: { id: string };
      actor?: BaseActor;
      data?: { actorId?: string };
    }>;
  };
  actors: {
    get(id: string): BaseActor | null;
  };
  scenes: {
    get(id: string): {
      tokens: {
        get(id: string): {
          id: string;
          name: string;
          actor?: BaseActor;
        } | null;
      };
    } | null;
  };
  combat?: {
    started: boolean;
    current?: { actorId?: string };
    combatants: Array<{
      actor?: { _id: string; system: unknown };
      actorId?: string;
      defeated?: boolean;
      update(data: Record<string, unknown>): Promise<void>;
    }>;
  } | null;
};

declare const canvas: {
  tokens?: {
    controlled?: Array<{
      id: string;
      actor?: BaseActor;
      data?: { actorId?: string };
    }>;
  };
};

declare const document: Document;

declare const CONFIG: {
  Actor: {
    dataModels: Record<string, unknown>;
    trackableAttributes: Record<string, unknown>;
  };
  Item: {
    dataModels: Record<string, unknown>;
  };
  Combat: {
    documentClass: typeof foundry.documents.Combat;
    dataModels: Record<string, unknown>;
    initiative: { formula: string | null; decimals: number };
  };
  ui: Record<string, new () => unknown>;
  Dawn?: {
    Archetypes?: Record<string, unknown>;
  };
  statusEffects: Record<string, unknown> | Array<Record<string, unknown>>;
};
