import { AdversaryDataModel, CharacterDataModel, TerrainDataModel, FodderDataModel } from "./data/actor-models.js";
import { TechniqueDataModel, EdgeDataModel, ComponentDataModel, ModifierDataModel } from "./data/item-models.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { AdversarySheet } from "./sheets/adversary-sheet.js";
import { TerrainSheet } from "./sheets/terrain-sheet.js";
import { FodderSheet } from "./sheets/fodder-sheet.js";
import { TechniqueSheet } from "./sheets/technique-sheet.js";
import { EdgeSheet } from "./sheets/edge-sheet.js";
import { ComponentSheet } from "./sheets/component-sheet.js";
import { ModifierSheet } from "./sheets/modifier-sheet.js";
import { DawnCombat } from "./combat/dawn-combat.js";
import { DawnCombatTracker } from "./combat/dawn-combat-tracker.js";
import { createTensionHud, updateTensionDisplay } from "./apps/tension-hud.js";
import { initTensionAutomation } from "./apps/tension-automation.js";
import { initStatusEffects } from "./apps/status-effects.js";
import {
  canApplyDamage,
  getOwnedTargets,
  applyDamageToTarget,
  openDamageDialog,
  postDamageSummary,
  DamageFluffData,
  DamageResult,
} from "./damage/damage.js";

foundry.helpers.Hooks.once("ready", () => {
  createTensionHud();
  // Set up automated tension tracking.
  initTensionAutomation();
});

foundry.helpers.Hooks.once("init", () => {
  console.log("dawn-system | Initialising Dawn System");

  // Register Tension world setting.
  game.settings.register("dawn-system", "tension", {
    name: "DAWN.Tension.Title",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
    range: { min: 0, max: 99, step: 1 },
    permissions: {
      GM: 2,
      Assistant: 1,
      Player: 1,
    },
  });

  // Replace Foundry default status effects with DAWN statuses.
  initStatusEffects();

  // Register the custom Combat document class and Combat Tracker UI.
  // CONFIG.Combat.documentClass is used for all Combat documents.
  // CONFIG.ui.combat is instantiated by Foundry during game setup.
  // Cast needed: Foundry's allowJs inference only partially infers config.mjs exports.
  (CONFIG as unknown as { Combat: { documentClass: unknown } }).Combat.documentClass = DawnCombat;
  (CONFIG as unknown as { ui: Record<string, unknown> }).ui.combat = DawnCombatTracker;

  // Listen for tension changes and update HUD display.
  foundry.helpers.Hooks.on("updateSetting", (...args: unknown[]) => {
    const obj = args[0] as { key?: string; value?: unknown };
    const key = typeof args[0] === "string" ? args[0] : obj?.key;
    if (key === "dawn-system.tension") {
      const val = obj?.value ?? game.settings.get("dawn-system", "tension");
      updateTensionDisplay(Number(val));
    }
  });

  // Register data models for each Actor sub-type.
  // Cast needed: Foundry's JSDoc types use a generic TypeDataModel that requires
  // an explicit cast when assigning concrete subclasses.
  const dataModels = CONFIG.Actor.dataModels as Record<string, unknown>;
  dataModels.character = CharacterDataModel;
  dataModels.adversary = AdversaryDataModel;
  dataModels.terrain = TerrainDataModel;
  dataModels.fodder = FodderDataModel;

  // Tell Foundry which attributes should appear as Token bars/values.
  // Foundry's JSDoc types trackableAttributes as Record<string, string> but
  // the actual structure is Record<string, {bar: string[], value: string[]}>.
  const trackable = CONFIG.Actor as unknown as {
    trackableAttributes: Record<string, { bar: string[]; value: string[] }>;
  };
  trackable.trackableAttributes = {
    character: { bar: ["health", "focus"], value: ["speed"] },
    adversary: { bar: [], value: ["tier"] },
    terrain: { bar: [], value: ["health"] },
    fodder: { bar: [], value: ["health"] },
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
  foundry.documents.collections.Actors.registerSheet("dawn-system", TerrainSheet, {
    types: ["terrain"],
    makeDefault: true,
    label: "DAWN.Sheet.Terrain.Title",
  });
  foundry.documents.collections.Actors.registerSheet("dawn-system", FodderSheet, {
    types: ["fodder"],
    makeDefault: true,
    label: "DAWN.Sheet.Fodder.Title",
  });

  // Register chat message render hook to inject damage button.
  foundry.helpers.Hooks.on("renderChatMessageHTML", (...args: unknown[]) => {
    const message = args[0] as any;
    const html = args[1] as HTMLElement;
    const fluff = message?.getFlag("dawn-system", "damage");
    if (!fluff) return;
    if (!fluff.targets || !fluff.targets.length || fluff.result < 1) return;
    if (!canApplyDamage(fluff as DamageFluffData)) return;

    const btn = document.createElement("button");
    btn.className = "damage-apply-btn";
    btn.innerHTML = '<i class="fa-solid fa-heart-crack"></i> ' + game.i18n.localize("DAWN.Damage.Apply");
    btn.addEventListener("click", async () => {
      try {
        const damageFluff = message.getFlag("dawn-system", "damage") as DamageFluffData;
        const targets = getOwnedTargets(damageFluff);
        if (!targets.length) {
          await foundry.applications.api.DialogV2.confirm({
            window: { title: "No Targets" },
            content: `<p>No damageable targets are selected. Select target tokens on the canvas first.</p>`,
            ok: { label: "Ok" },
            cancel: false,
          });
          return;
        }
        const damage = await openDamageDialog(targets, damageFluff.result);
        if (damage === null || damage === undefined) return;
        const results: DamageResult[] = [];
        for (const t of targets) {
          const r = await applyDamageToTarget(t.tokenId, t.sceneId, damage);
          if (r) results.push(r);
        }
        if (results.length) await postDamageSummary(results);
      } catch (e) {
        console.warn("dawn-system damage apply error", e);
      }
    });

    const content = html.querySelector(".message-content");
    if (content) content.appendChild(btn);
  });
});

// Expose damage functions for renderHook and sheet handlers.
export { canApplyDamage, applyDamageToTarget, postDamageSummary };
export type { DamageFluffData, DamageResult };

/**
 * Called from chat message. Opens damage dialog, applies damage, posts summary.
 * Filters targets to only those owned by the current user.
 */
export async function openDamageDialogFromChat(fluff: DamageFluffData): Promise<number | null> {
  const targets = getOwnedTargets(fluff);
  if (!targets.length) return null;
  return openDamageDialog(targets, fluff.result);
}
