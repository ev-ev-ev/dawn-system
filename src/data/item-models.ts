const { NumberField, StringField } = foundry.data.fields;

/**
 * Data model for the "technique" Item type.
 * Each item represents one purchased level of a technique tree.
 * The item's `name` field holds the level ability name (e.g. "Flash Of Insight").
 */
export class TechniqueDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      tech: new StringField({
        required: true,
        blank: true,
        initial: "",
        label: "DAWN.Item.Technique.Tech",
      }),
      archetype: new StringField({
        required: true,
        blank: true,
        initial: "",
        label: "DAWN.Item.Technique.Archetype",
      }),
      tags: new StringField({
        required: true,
        blank: true,
        initial: "",
        label: "DAWN.Item.Technique.Tags",
      }),
      stars: new StringField({
        required: true,
        blank: true,
        initial: "★",
        label: "DAWN.Item.Technique.Stars",
      }),
      flavor: new StringField({
        required: true,
        blank: true,
        initial: "",
        label: "DAWN.Item.Technique.Flavor",
      }),
      level: new NumberField({
        required: true,
        integer: true,
        min: 1,
        max: 3,
        initial: 1,
        label: "DAWN.Item.Technique.Level",
      }),
      text: new StringField({
        required: true,
        blank: true,
        initial: "",
        label: "DAWN.Item.Technique.Text",
      }),
    };
  }
}
