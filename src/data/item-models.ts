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

/**
 * Data model for the "edge" Item type.
 * Edges are special boss abilities with a defense, turn, and phase component.
 */
export class EdgeDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      flavor: new StringField({ required: true, blank: true, initial: "", label: "DAWN.Item.Edge.Flavor" }),
      defensename: new StringField({ required: true, blank: true, initial: "", label: "DAWN.Item.Edge.DefenseName" }),
      defense: new StringField({ required: true, blank: true, initial: "", label: "DAWN.Item.Edge.Defense" }),
      turnname: new StringField({ required: true, blank: true, initial: "", label: "DAWN.Item.Edge.TurnName" }),
      turn: new StringField({ required: true, blank: true, initial: "", label: "DAWN.Item.Edge.Turn" }),
      phasename: new StringField({ required: true, blank: true, initial: "", label: "DAWN.Item.Edge.PhaseName" }),
      phase: new StringField({ required: true, blank: true, initial: "", label: "DAWN.Item.Edge.Phase" }),
    };
  }
}

/** Shared schema fields for NPC stat-block item types (component & modifier). */
function npcAbilityFields(ns: string) {
  return {
    archetype: new StringField({ required: true, blank: true, initial: "", label: `${ns}.Archetype` }),
    flavor: new StringField({ required: true, blank: true, initial: "", label: `${ns}.Flavor` }),
    basehp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: `${ns}.BaseHP` }),
    tierhp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: `${ns}.TierHP` }),
    speed: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: `${ns}.Speed` }),
    passive: new StringField({ required: true, blank: true, initial: "", label: `${ns}.Passive` }),
    actionname: new StringField({ required: true, blank: true, initial: "", label: `${ns}.ActionName` }),
    action: new StringField({ required: true, blank: true, initial: "", label: `${ns}.Action` }),
    attackname: new StringField({ required: true, blank: true, initial: "", label: `${ns}.AttackName` }),
    attack: new StringField({ required: true, blank: true, initial: "", label: `${ns}.Attack` }),
    attackdice: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: `${ns}.AttackDice` }),
    attacktierdice: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: `${ns}.AttackTierDice` }),
    attacktensionx: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: `${ns}.AttackTensionX` }),
    acename: new StringField({ required: true, blank: true, initial: "", label: `${ns}.AceName` }),
    acetension: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: `${ns}.AceTension` }),
    ace: new StringField({ required: true, blank: true, initial: "", label: `${ns}.Ace` }),
  };
}

/**
 * Data model for the "component" Item type.
 * NPC component archetypes (Assassin, Bruiser, etc.).
 */
export class ComponentDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      ...npcAbilityFields("DAWN.Item.Component"),
      tierarmor: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Item.Component.TierArmor" }),
    };
  }
}

/**
 * Data model for the "modifier" Item type.
 * NPC modifiers that attach to enemies (Giant, Earthquake, etc.).
 */
export class ModifierDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      ...npcAbilityFields("DAWN.Item.Modifier"),
      baseevasion: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Item.Modifier.BaseEvasion" }),
      tierevasion: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Item.Modifier.TierEvasion" }),
      basearmor: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Item.Modifier.BaseArmor" }),
      tierarmor: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Item.Modifier.TierArmor" }),
    };
  }
}
