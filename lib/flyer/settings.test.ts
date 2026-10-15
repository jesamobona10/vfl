import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLYER_SETTINGS,
  hasCustomFlyerSettings,
  isHexColor,
  parseFlyerSettings,
  readFlyerSettings,
} from "@/lib/flyer/settings";

describe("isHexColor", () => {
  it.each(["#fff", "#ffffff", "#0F7C45", "#abc"])("accepts %s", (value) => {
    expect(isHexColor(value)).toBe(true);
  });

  it.each(["fff", "#ffff", "#gggggg", "red", "", null, 123])("rejects %s", (value) => {
    expect(isHexColor(value)).toBe(false);
  });
});

describe("parseFlyerSettings", () => {
  it("returns defaults for non-objects", () => {
    expect(parseFlyerSettings(null)).toEqual(DEFAULT_FLYER_SETTINGS);
    expect(parseFlyerSettings("nope")).toEqual(DEFAULT_FLYER_SETTINGS);
    expect(parseFlyerSettings([1, 2])).toEqual(DEFAULT_FLYER_SETTINGS);
  });

  it("falls back on invalid enum and colour values", () => {
    const parsed = parseFlyerSettings({
      template: "neon",
      format: "billboard",
      text_color: "white",
      accent_color: "#zzzzzz",
    });
    expect(parsed.template).toBe(DEFAULT_FLYER_SETTINGS.template);
    expect(parsed.format).toBe(DEFAULT_FLYER_SETTINGS.format);
    expect(parsed.text_color).toBe(DEFAULT_FLYER_SETTINGS.text_color);
    expect(parsed.accent_color).toBe(DEFAULT_FLYER_SETTINGS.accent_color);
  });

  it("keeps valid values and clamps the overlay", () => {
    const parsed = parseFlyerSettings({
      template: "bold",
      format: "story",
      text_color: "#000000",
      accent_color: "#0F7C45",
      overlay: 250,
      headline: "  Cup Final  ",
      subtitle: "Kick off soon",
      footer_text: "#league",
      show_logos: false,
      show_venue: false,
      show_competition: false,
      background_url: "  https://example.test/bg.png  ",
    });
    expect(parsed.template).toBe("bold");
    expect(parsed.format).toBe("story");
    expect(parsed.text_color).toBe("#000000");
    expect(parsed.accent_color).toBe("#0F7C45");
    expect(parsed.overlay).toBe(100);
    expect(parsed.headline).toBe("Cup Final");
    expect(parsed.subtitle).toBe("Kick off soon");
    expect(parsed.footer_text).toBe("#league");
    expect(parsed.show_logos).toBe(false);
    expect(parsed.show_venue).toBe(false);
    expect(parsed.show_competition).toBe(false);
    expect(parsed.background_url).toBe("https://example.test/bg.png");
  });

  it("drops empty strings to their fallbacks", () => {
    const parsed = parseFlyerSettings({ headline: "   ", subtitle: "", background_url: "" });
    expect(parsed.headline).toBe(DEFAULT_FLYER_SETTINGS.headline);
    expect(parsed.subtitle).toBe("");
    expect(parsed.background_url).toBeNull();
  });
});

describe("readFlyerSettings", () => {
  it("pulls the nested flyer object", () => {
    expect(readFlyerSettings({ flyer: { template: "minimal" } }).template).toBe("minimal");
  });

  it("defaults when settings are missing or malformed", () => {
    expect(readFlyerSettings(null)).toEqual(DEFAULT_FLYER_SETTINGS);
    expect(readFlyerSettings({})).toEqual(DEFAULT_FLYER_SETTINGS);
    expect(readFlyerSettings({ flyer: 5 })).toEqual(DEFAULT_FLYER_SETTINGS);
  });
});

describe("hasCustomFlyerSettings", () => {
  it("detects defaults", () => {
    expect(hasCustomFlyerSettings({ ...DEFAULT_FLYER_SETTINGS })).toBe(false);
    expect(hasCustomFlyerSettings({ ...DEFAULT_FLYER_SETTINGS, template: "bold" })).toBe(true);
  });
});
