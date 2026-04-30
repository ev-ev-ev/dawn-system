export class ComponentSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "item", "component"],
    window: { title: "DAWN.Sheet.Component.Title", resizable: true },
    position: { width: 620, height: 720 },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/items/component-sheet.hbs",
    },
  };

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: { system: Record<string, unknown> } }).document;
    return Object.assign(context, { system: document.system });
  }
}
