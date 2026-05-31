const { NumberField, StringField, SchemaField, BooleanField } = foundry.data.fields;

/**
 * Data model for the "character" Actor type.
 * Extends TypeDataModel to store per-type system data on Actors.
 */
export class CharacterDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      health: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 16, label: "DAWN.Actor.Character.Health" }),
      }),
      focus: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 2, label: "DAWN.Actor.Character.Focus" }),
      }),
      wounds: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0, label: "DAWN.Actor.Character.Wounds" }),
      stress: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0, label: "DAWN.Actor.Character.Stress" }),
      tier: new NumberField({
        required: true,
        integer: true,
        min: 1,
        max: 6,
        initial: 1,
        label: "DAWN.Actor.Character.Tier",
      }),
      primaryAttr: new StringField({ required: true, initial: "body", label: "DAWN.Actor.Character.PrimaryAttr" }),
      secondaryAttr: new StringField({ required: true, initial: "talent", label: "DAWN.Actor.Character.SecondaryAttr" }),
      body: new NumberField({ required: true, integer: true, min: 2, initial: 4, label: "DAWN.Actor.Character.Body" }),
      talent: new NumberField({ required: true, integer: true, min: 2, initial: 3, label: "DAWN.Actor.Character.Talent" }),
      spirit: new NumberField({ required: true, integer: true, min: 2, initial: 2, label: "DAWN.Actor.Character.Spirit" }),
      mind: new NumberField({ required: true, integer: true, min: 2, initial: 2, label: "DAWN.Actor.Character.Mind" }),
      evasion: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Actor.Character.Evasion" }),
      armor: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Actor.Character.Armor" }),
    };
  }

  override prepareBaseData() {
    super.prepareBaseData();    const s = this as any;
    const tier: number = s.tier ?? 1;
    const body: number = s.body ?? 4;
    const talent: number = s.talent ?? 3;
    const spirit: number = s.spirit ?? 2;
    const primary: string = s.primaryAttr ?? "body";
    const secondary: string = s.secondaryAttr ?? "talent";

    // Derived resource maximums
    s.health.max = 10 + body + tier * 2;
    s.focus.max = 1 + Math.floor(spirit / 2);

    // Derived speed (not a stored field)
    s.speed = 2 + Math.floor(talent / 2);

    // Total points = base 11 at tier 1, +2 per additional tier
    s.attrPointsTotal = 11 + (tier - 1) * 2;
    s.attrPointsSpent = body + talent + spirit + (s.mind ?? 2);
    s.attrPointsAvailable = s.attrPointsTotal - s.attrPointsSpent;

    // Per-attribute minimums enforced by role selection
    const attrs = ["body", "talent", "spirit", "mind"] as const;
    s.attrMin = {} as Record<string, number>;
    for (const attr of attrs) {
      s.attrMin[attr] = attr === primary ? 4 : attr === secondary ? 3 : 2;
    }
  }
}

/**
 * Data model for the "adversary" Actor type.
 */
export class AdversaryDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      tier: new NumberField({
        required: true,
        integer: true,
        min: 1,
        initial: 1,
        label: "DAWN.Actor.Adversary.Tier",
      }),
      health: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Actor.Adversary.Health" }),
      }),
      gates: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Actor.Adversary.Gates" }),
      }),
      evasion: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "DAWN.Actor.Adversary.Evasion" }),
      }),
    };
  }
}

/**
 * Data model for the "terrain" Actor type.
 * Only has a health property with no maximum.
 */
export class TerrainDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      health: new NumberField({
        required: true,
        integer: true,
        min: 0,
        initial: 10,
        label: "DAWN.Actor.Terrain.Health",
      }),
    };
  }
}

/**
 * Data model for the "fodder" Actor type.
 * Always has exactly 1 health.
 */
export class FodderDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      health: new NumberField({
        required: true,
        integer: true,
        min: 0,
        max: 1,
        initial: 1,
        label: "DAWN.Actor.Fodder.Health",
      }),
    };
  }
}
