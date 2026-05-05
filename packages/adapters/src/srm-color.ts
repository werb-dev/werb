/**
 * Standard SRM → sRGB rendering for visual color discs.
 *
 * Reference values published by Charlie Bamforth and reproduced in countless
 * brewing tools. Coverage 1–40 SRM; out-of-range values clamp.
 */

const SRM_HEX: Record<number, string> = {
  1: "#FFE699",
  2: "#FFD878",
  3: "#FFCA5A",
  4: "#FFBF42",
  5: "#FBB123",
  6: "#F8A600",
  7: "#F39C00",
  8: "#EA8F00",
  9: "#E58500",
  10: "#DE7C00",
  11: "#D77200",
  12: "#CB6200",
  13: "#BE5500",
  14: "#B04500",
  15: "#A63E00",
  16: "#993300",
  17: "#8E2900",
  18: "#822103",
  19: "#771E00",
  20: "#6B1D05",
  21: "#5D1A05",
  22: "#4F1607",
  23: "#3F1205",
  24: "#370D04",
  25: "#2E0902",
  26: "#260B02",
  27: "#1F0A02",
  28: "#1C0903",
  29: "#1A0903",
  30: "#180806",
  31: "#160808",
  32: "#150807",
  33: "#140807",
  34: "#130707",
  35: "#120707",
  36: "#110707",
  37: "#100707",
  38: "#0F0606",
  39: "#0E0505",
  40: "#0D0505",
};

export function srmToHex(srm: number): string {
  const k = Math.max(1, Math.min(40, Math.round(srm)));
  return SRM_HEX[k]!;
}
