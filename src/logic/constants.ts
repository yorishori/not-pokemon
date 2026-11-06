/**
 * Tunable rule numbers. Every number a game rule depends on lives here (see docs/GAME-RULES.md).
 * Grouped roughly as: content validation limits; battle, merge, encounter, NPC,
 * economy and save constants; then presentation timings and sizes.
 */

/** Maximum team size (each Regleta adds one slot up to this). */
export const TEAM_MAX = 6;

/** Euros are whole numbers from 0 to this. */
export const EUROS_MAX = 999_999;

/** Maximum count of one item in the bag (inventory counts are 0–99). */
export const ITEM_COUNT_MAX = 99;

/** Damage formula scale: `power × Atk/Def × DAMAGE_SCALE × r`. */
export const DAMAGE_SCALE = 0.3;

/** Range `[min, max]` of the random damage factor `r` (`rng.float(min, max)`). */
export const DAMAGE_ROLL: readonly [number, number] = [0.85, 1];

/** An effective stat is never below this fraction of the stat (after buffs/debuffs). */
export const MOD_MIN = 0.25;

/** An effective stat is never above this multiple of the stat (after buffs/debuffs). */
export const MOD_MAX = 2.5;

/** A merge adds this percent of the stat's *base* value (rounded, at least 1). */
export const MERGE_PERCENT = 10;

/** Merges never raise a stat above `MERGE_CAP × base` (so `bonus <= base` with 2). */
export const MERGE_CAP = 2;

/** A beaten (cooldown) NPC returns to `ready` when the player is more than this far (Manhattan). */
export const NPC_COOLDOWN_DISTANCE = 6;

/** Steps with no encounter roll after any battle or map change. */
export const SAFE_STEPS = 3;

/** An NPC enemy below this fraction of its max HP heals if it has a heal attack. */
export const NPC_LOW_HP = 0.25;

/** Current save format version (`flexymon.save.v1`). */
export const SAVE_VERSION = 1;

/** Current format version of the story realm's save (`flexymon.story.v1`). */
export const STORY_SAVE_VERSION = 1;

/** Time for the player to walk one tile, in ms. */
export const WALK_MS = 200;

/** Standing still, a press in a NEW direction shorter than this only turns the player (ms). */
export const TURN_TAP_MS = 100;

/** Warp transition: fade out, then fade in, each this long (ms). */
export const WARP_FADE_MS = 200;

/** Zone music crossfade (and first fade-in) duration (ms). */
export const MUSIC_FADE_MS = 500;

/** Dialogue text types out at this many characters per second. */
export const TEXT_CPS = 30;

/** The speaking NPC's `voice` plays once every this many typed characters. */
export const VOICE_EVERY_CHARS = 3;

/** Overworld → battle flash transition length (ms). */
export const BATTLE_FLASH_MS = 600;

/** HP bars animate to a new value over this many ms. */
export const HP_ANIM_MS = 400;

/** HP bar turns yellow below this fraction of max HP. */
export const HP_YELLOW_BELOW = 0.5;

/** HP bar turns red below this fraction of max HP. */
export const HP_RED_BELOW = 0.2;

/** Enemy NPC: the "!" bubble shows this long before the NPC walks up to the player (ms). */
export const NPC_ALERT_MS = 600;

/** Shop quantity picker: Right / Left change the quantity by this much (Up / Down by 1). */
export const QTY_BIG_STEP = 10;

/** Options: characters per second for each text speed (lenta / normal / rápida). Normal = `TEXT_CPS`. */
export const TEXT_SPEED_CPS: Readonly<Record<'slow' | 'normal' | 'fast', number>> = {
  slow: 15,
  normal: TEXT_CPS,
  fast: 60,
};

/** Options: music and effects volume are whole levels from 0 (silent) to this (full). */
export const VOLUME_STEPS = 10;

/** Options: the "Guardando…" icon shows this long after every auto-save (ms). */
export const SAVE_ICON_MS = 600;

/** Name entry: the player's name has at most this many characters. */
export const NAME_MAX_LENGTH = 10;

/** Title: "Pulsa START" blinks with this half-period (ms). */
export const TITLE_BLINK_MS = 500;

/** Minimap: the placeholder tool draws each map tile as a square of this many image pixels. */
export const MINIMAP_TILE_PX = 3;

/** Minimap: widest it is drawn on screen (base pixels); a bigger image is scaled down, never up. */
export const MINIMAP_MAX_W = 128;

/** Minimap: tallest it is drawn on screen (base pixels); a bigger image is scaled down, never up. */
export const MINIMAP_MAX_H = 96;

/** Minimap: distance from the top-left corner of the screen (base pixels). */
export const MINIMAP_MARGIN = 4;

/** Minimap: the player's dot blinks with this half-period (ms). */
export const MINIMAP_BLINK_MS = 300;

/** Touch D-pad: a touch closer to the pad's centre than this fraction of its half-width presses nothing. */
export const DPAD_DEAD_ZONE = 0.2;

/** Car: the Audi trip scene lasts this long (ms) unless skipped. */
export const CAR_TRIP_MS = 5000;

/** Car: any button skips the trip once it has run this long (ms). */
export const CAR_SKIP_AFTER_MS = 1000;

/** Debug menu: euros added by "Dar {n} €". */
export const DEBUG_GIVE_EUROS = 1000;

/** Debug menu: how many of an item "Dar: {item}" adds per press (capped by `ITEM_COUNT_MAX`). */
export const DEBUG_GIVE_ITEMS = 1;

/**
 * Accessibility: flashing effects stay UNDER this many flashes per second. Checked for every
 * flash and blink constant by `tests/logic/accessibility.test.ts` (`src/logic/accessibility.ts`).
 */
export const MAX_FLASHES_PER_SECOND = 3;

/** Battle transition: white screen flashes during `BATTLE_FLASH_MS` (2, was 3 — 5 per second). */
export const BATTLE_FLASHES = 2;

/** Dialogue box: the "more" arrow blinks with this half-period (ms). */
export const DIALOG_ARROW_BLINK_MS = 400;

/** Battle: a hit shakes the target sprite this many times, each `HIT_SHAKE_MS` there and back. */
export const HIT_SHAKES = 3;

/** Battle: one hit shake, there and back (ms). */
export const HIT_SHAKE_MS = 120;

/** Battle: a hit dims the target sprite ONCE, for this long (ms; it used to blink 3 times in 360 ms). */
export const HIT_DIM_MS = 360;
