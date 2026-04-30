import { openRollDialog } from "../dice/roll.js";

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
    return Object.assign(context, {
      system: document.system,
      techniques,
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
}
