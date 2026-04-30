/**
 * Minimal global declarations for the Foundry V14 runtime.
 * Used only during the Rollup build (tsconfig.build.json).
 * The real types come from Foundry's source at runtime.
 */

// Establish proper class inheritance chain for 'override' to work
declare class TypeDataModel {
  static defineSchema(): Record<string, unknown>;
  prepareBaseData(): void;
}

declare class ActorSheetV2 extends TypeDataModel {
  document: BaseActor;
  static DEFAULT_OPTIONS: Record<string, unknown>;
  static PARTS: Record<string, { template: string }>;
  _prepareContext(options: object): Promise<Record<string, unknown>>;
}

declare class ItemSheetV2 extends TypeDataModel {
  document: BaseItem;
  static DEFAULT_OPTIONS: Record<string, unknown>;
  static PARTS: Record<string, { template: string }>;
  _prepareContext(options: object): Promise<Record<string, unknown>>;
}

declare namespace foundry {
  namespace abstract {
    class TypeDataModel {
      static defineSchema(): Record<string, unknown>;
      prepareBaseData(): void;
    }
  }
  namespace applications {
    namespace api {
      function HandlebarsApplicationMixin<T extends new (...args: unknown[]) => any>(
        base: T
      ): T;
    }
    namespace sheets {
      class ActorSheetV2 {
        document: BaseActor;
        static DEFAULT_OPTIONS: Record<string, unknown>;
        static PARTS: Record<string, { template: string }>;
        _prepareContext(options: object): Promise<Record<string, unknown>>;
      }
      class ItemSheetV2 {
        document: BaseItem;
        static DEFAULT_OPTIONS: Record<string, unknown>;
        static PARTS: Record<string, { template: string }>;
        _prepareContext(options: object): Promise<Record<string, unknown>>;
      }
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
  namespace documents {
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
      system: Record<string, unknown>;
      getEmbeddedCollection(name: string): Array<{ id: string; name: string; type: string }>;
      toObject(): { system: Record<string, unknown> };
    }
    class BaseItem {
      id: string;
      name: string;
      type: string;
      system: Record<string, unknown>;
    }
  }
  namespace helpers {
    namespace Hooks {
      function once(event: string, fn: (...args: unknown[]) => void): void;
    }
  }
}

declare const CONFIG: {
  Actor: {
    dataModels: Record<string, unknown>;
    trackableAttributes: Record<string, unknown>;
  };
  Item: {
    dataModels: Record<string, unknown>;
  };
  Dawn?: {
    Archetypes?: Record<string, unknown>;
  };
};
