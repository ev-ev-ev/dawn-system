export class ModifierSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "item", "modifier"],
    window: { title: "DAWN.Sheet.Modifier.Title", resizable: true },
    position: { width: 520, height: 740 },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/items/modifier-sheet.hbs",
    },
  };

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: { system: Record<string, unknown> } }).document;
    return Object.assign(context, { system: document.system });
  }
}
