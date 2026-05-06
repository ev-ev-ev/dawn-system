import { openRollDialog } from "../dice/roll.js";
import { LearnTechniqueDialog } from "../apps/learn-technique-dialog.js";

export class CharacterSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "actor", "character"],
    window: { title: "DAWN.Sheet.Character.Title", resizable: true },
    position: { width: 480, height: 640 },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttr: CharacterSheet._onRollAttr,
      deleteItem: CharacterSheet._onDeleteItem,
      openItem: CharacterSheet._onOpenItem,
      chatItem: CharacterSheet._onChatItem,
      learnTechnique: CharacterSheet._onLearnTechnique,
      toggleWound: CharacterSheet._onToggleWound,
    },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/actors/character-sheet.hbs",
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "structured", icon: "fa-solid fa-list" },
        { id: "unstructured", icon: "fa-solid fa-feather" },
      ],
      initial: "structured",
      labelPrefix: "DAWN.Sheet.Character.Tab",
    },
  };

  private _scrollTop = 0;

  async _preRender(_context: object, _options: object) {
    const el = (this as any).element as HTMLElement | undefined;
    if (!el) return;
    const body = el.querySelector(".dawn-sheet.sheet-body");
    if (body) this._scrollTop = (body as HTMLElement).scrollTop;
  }

  async _onRender(_context: object, _options: object) {
    const el = (this as any).element as HTMLElement | undefined;
    if (!el) return;
    const scrollTop = this._scrollTop;
    setTimeout(() => {
      const body = el.querySelector(".dawn-sheet.sheet-body");
      if (body) (body as HTMLElement).scrollTop = scrollTop;
    }, 0);
  }

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: foundry.documents.BaseActor }).document;
    const allItems = ((document as unknown as { items: foundry.documents.BaseItem[] }).items ?? []);
    const techniques = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "technique")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => {
        const sa = a.system as Record<string, unknown>;
        const sb = b.system as Record<string, unknown>;
        const techCmp = String(sa.tech ?? "").localeCompare(String(sb.tech ?? ""));
        if (techCmp !== 0) return techCmp;
        return Number(sa.level ?? 1) - Number(sb.level ?? 1);
      });
    const woundsValue = Number((document.system as any).wounds ?? 0);
    const woundBoxes = Array.from({ length: 3 }, (_, i) => ({ index: i, checked: i < woundsValue }));
    return Object.assign(context, {
      system: document.system,
      techniques,
      woundBoxes,
      attrOptions: {
        body: "DAWN.Actor.Character.Body",
        talent: "DAWN.Actor.Character.Talent",
        spirit: "DAWN.Actor.Character.Spirit",
        mind: "DAWN.Actor.Character.Mind",
      },
    });
  }

  static async _onRollAttr(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const attr = target.dataset.attr as string;
    const system = (this as any).document.system as Record<string, unknown>;
    const dice = Number(system[attr] ?? 2);
    const labelKey = `DAWN.Actor.Character.${attr.charAt(0).toUpperCase() + attr.slice(1)}`;
    await openRollDialog(labelKey, dice, (this as any).document);
  }

  static async _onDeleteItem(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as (foundry.documents.BaseItem & { delete(): Promise<unknown> }) | undefined;
    await item?.delete();
  }

  static async _onOpenItem(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as (foundry.documents.BaseItem & { sheet: { render(force: boolean): void } }) | undefined;
    item?.sheet?.render(true);
  }

  static async _onLearnTechnique(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const dialog = new LearnTechniqueDialog((this as any).document);
    await dialog.render(true);
  }

  static async _onChatItem(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as foundry.documents.BaseItem | undefined;
    if (!item) return;
    const s = item.system as Record<string, unknown>;
    const content = `<strong>${item.name}</strong> <span style="opacity:0.7;font-size:0.85em">(${s.tech ?? ""} #${s.level ?? 1})</span><hr>${s.text ?? ""}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onToggleWound(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.woundIndex);
    const current = Number((this as any).document.system.wounds ?? 0);
    const newValue = index < current ? current - 1 : current + 1;
    await (this as any).document.update({ "system.wounds": newValue });
  }
}
