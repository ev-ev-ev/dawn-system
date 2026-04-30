import { AdversaryDataModel, CharacterDataModel } from "./data/actor-models.js";
import { TechniqueDataModel, EdgeDataModel, ComponentDataModel, ModifierDataModel } from "./data/item-models.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { AdversarySheet } from "./sheets/adversary-sheet.js";
import { TechniqueSheet } from "./sheets/technique-sheet.js";
import { EdgeSheet } from "./sheets/edge-sheet.js";
import { ComponentSheet } from "./sheets/component-sheet.js";
import { ModifierSheet } from "./sheets/modifier-sheet.js";

foundry.helpers.Hooks.once("init", () => {
  console.log("dawn-system | Initialising Dawn System");

  // Register data models for each Actor sub-type.
  // Cast needed: Foundry's JSDoc types use a generic TypeDataModel that requires
  // an explicit cast when assigning concrete subclasses.
  const dataModels = CONFIG.Actor.dataModels as Record<string, unknown>;
  dataModels.character = CharacterDataModel;
  dataModels.adversary = AdversaryDataModel;

  // Tell Foundry which attributes should appear as Token bars/values.
  // Foundry's JSDoc types trackableAttributes as Record<string, string> but
  // the actual structure is Record<string, {bar: string[], value: string[]}>.
  const trackable = CONFIG.Actor as unknown as {
    trackableAttributes: Record<string, { bar: string[]; value: string[] }>;
  };
  trackable.trackableAttributes = {
    character: { bar: ["health", "focus"], value: ["speed"] },
    adversary: { bar: [], value: ["tier"] },
  };

  // Register item data models.
  const itemDataModels = CONFIG.Item.dataModels as Record<string, unknown>;
  itemDataModels.technique = TechniqueDataModel;
  itemDataModels.edge = EdgeDataModel;
  itemDataModels.component = ComponentDataModel;
  itemDataModels.modifier = ModifierDataModel;

  // Register item sheets.
  foundry.documents.collections.Items.registerSheet("dawn-system", TechniqueSheet, {
    types: ["technique"],
    makeDefault: true,
    label: "DAWN.Sheet.Technique.Title",
  });
  foundry.documents.collections.Items.registerSheet("dawn-system", EdgeSheet, {
    types: ["edge"],
    makeDefault: true,
    label: "DAWN.Sheet.Edge.Title",
  });
  foundry.documents.collections.Items.registerSheet("dawn-system", ComponentSheet, {
    types: ["component"],
    makeDefault: true,
    label: "DAWN.Sheet.Component.Title",
  });
  foundry.documents.collections.Items.registerSheet("dawn-system", ModifierSheet, {
    types: ["modifier"],
    makeDefault: true,
    label: "DAWN.Sheet.Modifier.Title",
  });

  // Register actor sheets.
  foundry.documents.collections.Actors.registerSheet("dawn-system", CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "DAWN.Sheet.Character.Title",
  });
  foundry.documents.collections.Actors.registerSheet("dawn-system", AdversarySheet, {
    types: ["adversary"],
    makeDefault: true,
    label: "DAWN.Sheet.Adversary.Title",
  });
});
