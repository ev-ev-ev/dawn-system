type TechEntry = {
  id: string;
  name: string;
  tech: string;
  archetype: string;
  level: number;
  text: string;
  flavor: string;
  stars: string;
};

type ArchetypeGroup = {
  archetype: string;
  techniques: TechEntry[];
};

type GameWithPacks = {
  packs: {
    get(id: string): {
      getDocuments(): Promise<foundry.documents.BaseItem[]>;
      getDocument(id: string): Promise<(foundry.documents.BaseItem & { toObject(): Record<string, unknown> }) | undefined>;
    } | undefined;
  };
};

export class LearnTechniqueDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  // ApplicationV2 is not exposed in the inferred TS types; access via cast
  (foundry.applications.api as unknown as {
    ApplicationV2: Parameters<typeof foundry.applications.api.HandlebarsApplicationMixin>[0];
  }).ApplicationV2
) {
  private _actor: foundry.documents.BaseActor;
  private _closedArchetypes = new Set<string>();
  private _scrollTop = 0;

  constructor(actor: foundry.documents.BaseActor, options: object = {}) {
    super(options as never);
    this._actor = actor;
  }

  async _preRender(_context: object, _options: object) {
    const el = (this as any).element as HTMLElement | undefined;
    if (!el) return;
    const list = el.querySelector(".learn-technique-list");
    if (list) this._scrollTop = (list as HTMLElement).scrollTop;
    this._closedArchetypes.clear();
    el.querySelectorAll<HTMLDetailsElement>(".learn-archetype-group").forEach(details => {
      if (!details.open) {
        const text = details.querySelector(".learn-archetype-header")?.textContent?.trim();
        if (text) this._closedArchetypes.add(text);
      }
    });
  }

  async _onRender(_context: object, _options: object) {
    const el = (this as any).element as HTMLElement | undefined;
    if (!el) return;
    el.querySelectorAll<HTMLDetailsElement>(".learn-archetype-group").forEach(details => {
      const text = details.querySelector(".learn-archetype-header")?.textContent?.trim();
      const shouldClose = text ? this._closedArchetypes.has(text) : false;
      if (text && this._closedArchetypes.has(text)) details.removeAttribute("open");
    });
    const scrollTop = this._scrollTop;
    setTimeout(() => {
      const list = el.querySelector(".learn-technique-list");
      if (list) (list as HTMLElement).scrollTop = scrollTop;
    }, 0);
  }

  static DEFAULT_OPTIONS = {
    id: "learn-technique",
    classes: ["dawn-system", "learn-technique-dialog"],
    window: { title: "DAWN.Dialog.LearnTechnique.Title", resizable: true },
    position: { width: 700, height: 620 },
    actions: {
      learnTechnique: LearnTechniqueDialog._onLearnTechnique,
    },
  };

  static PARTS = {
    body: {
      template: "systems/dawn-system/templates/dialogs/learn-technique.hbs",
      scrollable: [".learn-technique-list"],
    },
  };

  async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);

    // Collect what the actor already knows
    const actorItems = (
      this._actor as unknown as {
        items: { filter(fn: (i: foundry.documents.BaseItem) => boolean): foundry.documents.BaseItem[] };
      }
    ).items;

    const actorTechniques = actorItems
      .filter((i: foundry.documents.BaseItem) => i.type === "technique")
      .map((i: foundry.documents.BaseItem) => {
        const s = i.system as Record<string, unknown>;
        return {
          tech: String(s.tech ?? ""),
          level: Number(s.level ?? 1),
          archetype: String(s.archetype ?? ""),
        };
      });

    const learnedArchetypes = new Set(actorTechniques.map((t) => t.archetype).filter(Boolean));
    // Key: "tech||level"
    const learnedPairs = new Set(actorTechniques.map((t) => `${t.tech}||${t.level}`));

    // Load all techniques from the compendium
    const g = game as unknown as GameWithPacks;
    const pack = g.packs.get("dawn-system.techniques");
    let allTechniques: TechEntry[] = [];
    if (pack) {
      const docs = await pack.getDocuments();
      allTechniques = docs
        .filter((doc) => doc.type === "technique")
        .map((doc) => {
          const s = doc.system as Record<string, unknown>;
          return {
            id: doc.id as string,
            name: (doc.name as string) ?? "",
            tech: String(s.tech ?? ""),
            archetype: String(s.archetype ?? ""),
            level: Number(s.level ?? 1),
            text: String(s.text ?? ""),
            flavor: String(s.flavor ?? ""),
            stars: String(s.stars ?? "★"),
          };
        });
    }

    // Filter to eligible techniques
    const eligible = allTechniques.filter((t) => {
      // Skip already learned
      if (learnedPairs.has(`${t.tech}||${t.level}`)) return false;

      // Rule 1: archetype restriction
      // If 3+ distinct archetypes are known, only allow those archetypes
      if (learnedArchetypes.size >= 3 && !learnedArchetypes.has(t.archetype)) return false;

      // Rule 2: must know all lower levels of this tech tree
      for (let l = 1; l < t.level; l++) {
        if (!learnedPairs.has(`${t.tech}||${l}`)) return false;
      }

      return true;
    });

    // Sort: archetype → tech tree → level
    eligible.sort((a, b) => {
      const archCmp = a.archetype.localeCompare(b.archetype);
      if (archCmp !== 0) return archCmp;
      const techCmp = a.tech.localeCompare(b.tech);
      if (techCmp !== 0) return techCmp;
      return a.level - b.level;
    });

    // Group by archetype
    const groupMap = new Map<string, TechEntry[]>();
    for (const t of eligible) {
      const key = t.archetype || "—";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(t);
    }
    const groups: ArchetypeGroup[] = Array.from(groupMap.entries()).map(([archetype, techniques]) => ({
      archetype,
      techniques,
    }));

    return Object.assign(context, {
      groups,
      hasAny: groups.length > 0,
      learnedArchetypeCount: learnedArchetypes.size,
    });
  }

  static async _onLearnTechnique(
    this: LearnTechniqueDialog,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const docId = target.dataset.docId;
    if (!docId) return;

    const g = game as unknown as GameWithPacks;
    const pack = g.packs.get("dawn-system.techniques");
    if (!pack) return;

    const doc = await pack.getDocument(docId);
    if (!doc) return;

    await (
      this._actor as unknown as {
        createEmbeddedDocuments(type: string, data: Record<string, unknown>[]): Promise<unknown>;
      }
    ).createEmbeddedDocuments("Item", [doc.toObject()]);

    // Refresh the dialog so eligibility updates
    this.render();
  }
}
