import type { StyleEntry } from "./types.ts";

/**
 * BJCP 2021 beer style guidelines, curated as a typed catalog. Ranges
 * are taken directly from the published guideline at bjcp.org/style/2021/.
 * Categories 28-34 (Specialty / Mixed-Style / Experimental) are mostly
 * "vary depending on the declared base beer" and don't fit a numeric
 * picker — they're omitted. Mead / cider categories are also omitted;
 * Werb is beer-focused for now.
 */
export const STYLES: StyleEntry[] = [
  // 1. Standard American Beer
  { name: "American Light Lager", category: "Standard American Beer", category_number: 1, style_letter: "A", type: "lager", og_min: 1.028, og_max: 1.040, fg_min: 0.998, fg_max: 1.008, ibu_min: 8, ibu_max: 12, srm_min: 2, srm_max: 3, abv_min: 2.8, abv_max: 4.2 },
  { name: "American Lager", category: "Standard American Beer", category_number: 1, style_letter: "B", type: "lager", og_min: 1.040, og_max: 1.050, fg_min: 1.004, fg_max: 1.010, ibu_min: 8, ibu_max: 18, srm_min: 2, srm_max: 3.5, abv_min: 4.2, abv_max: 5.3 },
  { name: "Cream Ale", category: "Standard American Beer", category_number: 1, style_letter: "C", type: "ale", og_min: 1.042, og_max: 1.055, fg_min: 1.006, fg_max: 1.012, ibu_min: 8, ibu_max: 20, srm_min: 2, srm_max: 5, abv_min: 4.2, abv_max: 5.6 },
  { name: "American Wheat Beer", category: "Standard American Beer", category_number: 1, style_letter: "D", type: "wheat", og_min: 1.040, og_max: 1.055, fg_min: 1.008, fg_max: 1.013, ibu_min: 15, ibu_max: 30, srm_min: 3, srm_max: 6, abv_min: 4, abv_max: 5.5 },

  // 2. International Lager
  { name: "International Pale Lager", category: "International Lager", category_number: 2, style_letter: "A", type: "lager", og_min: 1.042, og_max: 1.050, fg_min: 1.008, fg_max: 1.012, ibu_min: 18, ibu_max: 25, srm_min: 2, srm_max: 6, abv_min: 4.5, abv_max: 6 },
  { name: "International Amber Lager", category: "International Lager", category_number: 2, style_letter: "B", type: "lager", og_min: 1.042, og_max: 1.055, fg_min: 1.008, fg_max: 1.014, ibu_min: 8, ibu_max: 25, srm_min: 6, srm_max: 14, abv_min: 4.5, abv_max: 6 },
  { name: "International Dark Lager", category: "International Lager", category_number: 2, style_letter: "C", type: "lager", og_min: 1.044, og_max: 1.056, fg_min: 1.008, fg_max: 1.012, ibu_min: 8, ibu_max: 20, srm_min: 14, srm_max: 30, abv_min: 4.2, abv_max: 6 },

  // 3. Czech Lager
  { name: "Czech Pale Lager", category: "Czech Lager", category_number: 3, style_letter: "A", type: "lager", og_min: 1.028, og_max: 1.044, fg_min: 1.008, fg_max: 1.014, ibu_min: 20, ibu_max: 35, srm_min: 3, srm_max: 6, abv_min: 3, abv_max: 4.1 },
  { name: "Czech Premium Pale Lager", category: "Czech Lager", category_number: 3, style_letter: "B", type: "lager", og_min: 1.044, og_max: 1.060, fg_min: 1.013, fg_max: 1.017, ibu_min: 30, ibu_max: 45, srm_min: 3.5, srm_max: 6, abv_min: 4.2, abv_max: 5.8 },
  { name: "Czech Amber Lager", category: "Czech Lager", category_number: 3, style_letter: "C", type: "lager", og_min: 1.044, og_max: 1.060, fg_min: 1.013, fg_max: 1.017, ibu_min: 20, ibu_max: 35, srm_min: 10, srm_max: 16, abv_min: 4.4, abv_max: 5.8 },
  { name: "Czech Dark Lager", category: "Czech Lager", category_number: 3, style_letter: "D", type: "lager", og_min: 1.044, og_max: 1.060, fg_min: 1.013, fg_max: 1.017, ibu_min: 18, ibu_max: 34, srm_min: 17, srm_max: 35, abv_min: 4.4, abv_max: 5.8 },

  // 4. Pale Malty European Lager
  { name: "Munich Helles", category: "Pale Malty European Lager", category_number: 4, style_letter: "A", type: "lager", og_min: 1.044, og_max: 1.048, fg_min: 1.006, fg_max: 1.012, ibu_min: 16, ibu_max: 22, srm_min: 3, srm_max: 5, abv_min: 4.7, abv_max: 5.4 },
  { name: "Festbier", category: "Pale Malty European Lager", category_number: 4, style_letter: "B", type: "lager", og_min: 1.054, og_max: 1.057, fg_min: 1.010, fg_max: 1.012, ibu_min: 18, ibu_max: 25, srm_min: 4, srm_max: 7, abv_min: 5.8, abv_max: 6.3 },
  { name: "Helles Bock", category: "Pale Malty European Lager", category_number: 4, style_letter: "C", type: "lager", og_min: 1.064, og_max: 1.072, fg_min: 1.011, fg_max: 1.018, ibu_min: 23, ibu_max: 35, srm_min: 6, srm_max: 11, abv_min: 6.3, abv_max: 7.4 },

  // 5. Pale Bitter European Beer
  { name: "German Leichtbier", category: "Pale Bitter European Beer", category_number: 5, style_letter: "A", type: "lager", og_min: 1.026, og_max: 1.034, fg_min: 1.006, fg_max: 1.010, ibu_min: 15, ibu_max: 28, srm_min: 2, srm_max: 5, abv_min: 2.4, abv_max: 3.6 },
  { name: "Kölsch", category: "Pale Bitter European Beer", category_number: 5, style_letter: "B", type: "ale", og_min: 1.044, og_max: 1.050, fg_min: 1.007, fg_max: 1.011, ibu_min: 18, ibu_max: 30, srm_min: 3.5, srm_max: 5, abv_min: 4.4, abv_max: 5.2 },
  { name: "German Helles Exportbier", category: "Pale Bitter European Beer", category_number: 5, style_letter: "C", type: "lager", og_min: 1.048, og_max: 1.056, fg_min: 1.010, fg_max: 1.015, ibu_min: 20, ibu_max: 30, srm_min: 4, srm_max: 7, abv_min: 4.8, abv_max: 6 },
  { name: "German Pils", category: "Pale Bitter European Beer", category_number: 5, style_letter: "D", type: "lager", og_min: 1.044, og_max: 1.050, fg_min: 1.008, fg_max: 1.013, ibu_min: 22, ibu_max: 40, srm_min: 2, srm_max: 5, abv_min: 4.4, abv_max: 5.2 },

  // 6. Amber Malty European Lager
  { name: "Märzen", category: "Amber Malty European Lager", category_number: 6, style_letter: "A", type: "lager", og_min: 1.054, og_max: 1.060, fg_min: 1.010, fg_max: 1.014, ibu_min: 18, ibu_max: 24, srm_min: 8, srm_max: 17, abv_min: 5.8, abv_max: 6.3 },
  { name: "Rauchbier", category: "Amber Malty European Lager", category_number: 6, style_letter: "B", type: "lager", og_min: 1.050, og_max: 1.057, fg_min: 1.012, fg_max: 1.016, ibu_min: 20, ibu_max: 30, srm_min: 12, srm_max: 22, abv_min: 4.8, abv_max: 6 },
  { name: "Dunkles Bock", category: "Amber Malty European Lager", category_number: 6, style_letter: "C", type: "lager", og_min: 1.064, og_max: 1.072, fg_min: 1.013, fg_max: 1.019, ibu_min: 20, ibu_max: 27, srm_min: 14, srm_max: 22, abv_min: 6.3, abv_max: 7.2 },

  // 7. Amber Bitter European Beer
  { name: "Vienna Lager", category: "Amber Bitter European Beer", category_number: 7, style_letter: "A", type: "lager", og_min: 1.048, og_max: 1.055, fg_min: 1.010, fg_max: 1.014, ibu_min: 18, ibu_max: 30, srm_min: 9, srm_max: 15, abv_min: 4.5, abv_max: 5.5 },
  { name: "Altbier", category: "Amber Bitter European Beer", category_number: 7, style_letter: "B", type: "ale", og_min: 1.044, og_max: 1.052, fg_min: 1.008, fg_max: 1.014, ibu_min: 25, ibu_max: 50, srm_min: 11, srm_max: 17, abv_min: 4.3, abv_max: 5.5 },

  // 8. Dark European Lager
  { name: "Munich Dunkel", category: "Dark European Lager", category_number: 8, style_letter: "A", type: "lager", og_min: 1.048, og_max: 1.056, fg_min: 1.010, fg_max: 1.016, ibu_min: 18, ibu_max: 28, srm_min: 14, srm_max: 28, abv_min: 4.5, abv_max: 5.6 },
  { name: "Schwarzbier", category: "Dark European Lager", category_number: 8, style_letter: "B", type: "lager", og_min: 1.046, og_max: 1.052, fg_min: 1.010, fg_max: 1.016, ibu_min: 20, ibu_max: 30, srm_min: 17, srm_max: 30, abv_min: 4.4, abv_max: 5.4 },

  // 9. Strong European Beer
  { name: "Doppelbock", category: "Strong European Beer", category_number: 9, style_letter: "A", type: "lager", og_min: 1.072, og_max: 1.112, fg_min: 1.016, fg_max: 1.024, ibu_min: 16, ibu_max: 26, srm_min: 6, srm_max: 25, abv_min: 7, abv_max: 10 },
  { name: "Eisbock", category: "Strong European Beer", category_number: 9, style_letter: "B", type: "lager", og_min: 1.078, og_max: 1.120, fg_min: 1.020, fg_max: 1.035, ibu_min: 25, ibu_max: 35, srm_min: 18, srm_max: 30, abv_min: 9, abv_max: 14 },
  { name: "Baltic Porter", category: "Strong European Beer", category_number: 9, style_letter: "C", type: "lager", og_min: 1.060, og_max: 1.090, fg_min: 1.016, fg_max: 1.024, ibu_min: 20, ibu_max: 40, srm_min: 17, srm_max: 30, abv_min: 6.5, abv_max: 9.5 },

  // 10. German Wheat Beer
  { name: "Weissbier", category: "German Wheat Beer", category_number: 10, style_letter: "A", type: "wheat", og_min: 1.044, og_max: 1.052, fg_min: 1.010, fg_max: 1.014, ibu_min: 8, ibu_max: 15, srm_min: 2, srm_max: 6, abv_min: 4.3, abv_max: 5.6 },
  { name: "Dunkles Weissbier", category: "German Wheat Beer", category_number: 10, style_letter: "B", type: "wheat", og_min: 1.044, og_max: 1.056, fg_min: 1.010, fg_max: 1.014, ibu_min: 10, ibu_max: 18, srm_min: 14, srm_max: 23, abv_min: 4.3, abv_max: 5.6 },
  { name: "Weizenbock", category: "German Wheat Beer", category_number: 10, style_letter: "C", type: "wheat", og_min: 1.064, og_max: 1.090, fg_min: 1.015, fg_max: 1.022, ibu_min: 15, ibu_max: 30, srm_min: 6, srm_max: 25, abv_min: 6.5, abv_max: 9 },

  // 11. British Bitter
  { name: "Ordinary Bitter", category: "British Bitter", category_number: 11, style_letter: "A", type: "ale", og_min: 1.030, og_max: 1.039, fg_min: 1.007, fg_max: 1.011, ibu_min: 25, ibu_max: 35, srm_min: 8, srm_max: 14, abv_min: 3.2, abv_max: 3.8 },
  { name: "Best Bitter", category: "British Bitter", category_number: 11, style_letter: "B", type: "ale", og_min: 1.040, og_max: 1.048, fg_min: 1.008, fg_max: 1.012, ibu_min: 25, ibu_max: 40, srm_min: 8, srm_max: 16, abv_min: 3.8, abv_max: 4.6 },
  { name: "Strong Bitter", category: "British Bitter", category_number: 11, style_letter: "C", type: "ale", og_min: 1.048, og_max: 1.060, fg_min: 1.010, fg_max: 1.016, ibu_min: 30, ibu_max: 50, srm_min: 8, srm_max: 18, abv_min: 4.6, abv_max: 6.2 },

  // 12. Pale Commonwealth Beer
  { name: "British Golden Ale", category: "Pale Commonwealth Beer", category_number: 12, style_letter: "A", type: "ale", og_min: 1.038, og_max: 1.053, fg_min: 1.006, fg_max: 1.012, ibu_min: 20, ibu_max: 45, srm_min: 2, srm_max: 5, abv_min: 3.8, abv_max: 5 },
  { name: "Australian Sparkling Ale", category: "Pale Commonwealth Beer", category_number: 12, style_letter: "B", type: "ale", og_min: 1.038, og_max: 1.050, fg_min: 1.004, fg_max: 1.006, ibu_min: 20, ibu_max: 35, srm_min: 4, srm_max: 7, abv_min: 4.5, abv_max: 6 },
  { name: "English IPA", category: "Pale Commonwealth Beer", category_number: 12, style_letter: "C", type: "ale", og_min: 1.050, og_max: 1.075, fg_min: 1.010, fg_max: 1.018, ibu_min: 40, ibu_max: 60, srm_min: 6, srm_max: 14, abv_min: 5, abv_max: 7.5 },

  // 13. Brown British Beer
  { name: "Dark Mild", category: "Brown British Beer", category_number: 13, style_letter: "A", type: "ale", og_min: 1.030, og_max: 1.038, fg_min: 1.008, fg_max: 1.013, ibu_min: 10, ibu_max: 25, srm_min: 14, srm_max: 25, abv_min: 3, abv_max: 3.8 },
  { name: "London Brown Ale", category: "Brown British Beer", category_number: 13, style_letter: "B", type: "ale", og_min: 1.033, og_max: 1.038, fg_min: 1.012, fg_max: 1.015, ibu_min: 15, ibu_max: 20, srm_min: 22, srm_max: 35, abv_min: 2.8, abv_max: 3.6 },
  { name: "English Porter", category: "Brown British Beer", category_number: 13, style_letter: "C", type: "ale", og_min: 1.040, og_max: 1.052, fg_min: 1.008, fg_max: 1.014, ibu_min: 18, ibu_max: 35, srm_min: 20, srm_max: 30, abv_min: 4, abv_max: 5.4 },

  // 14. Scottish Ale
  { name: "Scottish Light", category: "Scottish Ale", category_number: 14, style_letter: "A", type: "ale", og_min: 1.030, og_max: 1.035, fg_min: 1.010, fg_max: 1.013, ibu_min: 10, ibu_max: 20, srm_min: 17, srm_max: 25, abv_min: 2.5, abv_max: 3.3 },
  { name: "Scottish Heavy", category: "Scottish Ale", category_number: 14, style_letter: "B", type: "ale", og_min: 1.035, og_max: 1.040, fg_min: 1.010, fg_max: 1.015, ibu_min: 10, ibu_max: 20, srm_min: 12, srm_max: 20, abv_min: 3.3, abv_max: 3.9 },
  { name: "Scottish Export", category: "Scottish Ale", category_number: 14, style_letter: "C", type: "ale", og_min: 1.040, og_max: 1.060, fg_min: 1.010, fg_max: 1.016, ibu_min: 15, ibu_max: 30, srm_min: 12, srm_max: 20, abv_min: 3.9, abv_max: 6 },

  // 15. Irish Beer
  { name: "Irish Red Ale", category: "Irish Beer", category_number: 15, style_letter: "A", type: "ale", og_min: 1.036, og_max: 1.046, fg_min: 1.010, fg_max: 1.014, ibu_min: 18, ibu_max: 28, srm_min: 9, srm_max: 14, abv_min: 3.8, abv_max: 5 },
  { name: "Irish Stout", category: "Irish Beer", category_number: 15, style_letter: "B", type: "ale", og_min: 1.036, og_max: 1.044, fg_min: 1.007, fg_max: 1.011, ibu_min: 25, ibu_max: 45, srm_min: 25, srm_max: 40, abv_min: 3.8, abv_max: 5 },
  { name: "Irish Extra Stout", category: "Irish Beer", category_number: 15, style_letter: "C", type: "ale", og_min: 1.052, og_max: 1.062, fg_min: 1.010, fg_max: 1.014, ibu_min: 35, ibu_max: 50, srm_min: 30, srm_max: 40, abv_min: 5, abv_max: 6.5 },

  // 16. Dark British Beer
  { name: "Sweet Stout", category: "Dark British Beer", category_number: 16, style_letter: "A", type: "ale", og_min: 1.044, og_max: 1.060, fg_min: 1.012, fg_max: 1.024, ibu_min: 20, ibu_max: 40, srm_min: 30, srm_max: 40, abv_min: 4, abv_max: 6 },
  { name: "Oatmeal Stout", category: "Dark British Beer", category_number: 16, style_letter: "B", type: "ale", og_min: 1.045, og_max: 1.065, fg_min: 1.010, fg_max: 1.018, ibu_min: 25, ibu_max: 40, srm_min: 22, srm_max: 40, abv_min: 4.2, abv_max: 5.9 },
  { name: "Tropical Stout", category: "Dark British Beer", category_number: 16, style_letter: "C", type: "ale", og_min: 1.056, og_max: 1.075, fg_min: 1.010, fg_max: 1.018, ibu_min: 30, ibu_max: 50, srm_min: 30, srm_max: 40, abv_min: 5.5, abv_max: 8 },
  { name: "Foreign Extra Stout", category: "Dark British Beer", category_number: 16, style_letter: "D", type: "ale", og_min: 1.056, og_max: 1.075, fg_min: 1.010, fg_max: 1.018, ibu_min: 50, ibu_max: 70, srm_min: 30, srm_max: 40, abv_min: 6.3, abv_max: 8 },

  // 17. Strong British Ale
  { name: "British Strong Ale", category: "Strong British Ale", category_number: 17, style_letter: "A", type: "ale", og_min: 1.055, og_max: 1.080, fg_min: 1.015, fg_max: 1.022, ibu_min: 30, ibu_max: 60, srm_min: 8, srm_max: 22, abv_min: 5.5, abv_max: 8 },
  { name: "Old Ale", category: "Strong British Ale", category_number: 17, style_letter: "B", type: "ale", og_min: 1.055, og_max: 1.088, fg_min: 1.015, fg_max: 1.022, ibu_min: 30, ibu_max: 60, srm_min: 10, srm_max: 22, abv_min: 5.5, abv_max: 9 },
  { name: "Wee Heavy", category: "Strong British Ale", category_number: 17, style_letter: "C", type: "ale", og_min: 1.070, og_max: 1.130, fg_min: 1.018, fg_max: 1.040, ibu_min: 17, ibu_max: 35, srm_min: 14, srm_max: 25, abv_min: 6.5, abv_max: 10 },
  { name: "English Barleywine", category: "Strong British Ale", category_number: 17, style_letter: "D", type: "ale", og_min: 1.080, og_max: 1.120, fg_min: 1.018, fg_max: 1.030, ibu_min: 35, ibu_max: 70, srm_min: 8, srm_max: 22, abv_min: 8, abv_max: 12 },

  // 18. Pale American Ale
  { name: "Blonde Ale", category: "Pale American Ale", category_number: 18, style_letter: "A", type: "ale", og_min: 1.038, og_max: 1.054, fg_min: 1.008, fg_max: 1.013, ibu_min: 15, ibu_max: 28, srm_min: 3, srm_max: 6, abv_min: 3.8, abv_max: 5.5 },
  { name: "American Pale Ale", category: "Pale American Ale", category_number: 18, style_letter: "B", type: "ale", og_min: 1.045, og_max: 1.060, fg_min: 1.010, fg_max: 1.015, ibu_min: 30, ibu_max: 50, srm_min: 5, srm_max: 10, abv_min: 4.5, abv_max: 6.2 },

  // 19. Amber and Brown American Beer
  { name: "American Amber Ale", category: "Amber and Brown American Beer", category_number: 19, style_letter: "A", type: "ale", og_min: 1.045, og_max: 1.060, fg_min: 1.010, fg_max: 1.015, ibu_min: 25, ibu_max: 40, srm_min: 10, srm_max: 17, abv_min: 4.5, abv_max: 6.2 },
  { name: "California Common", category: "Amber and Brown American Beer", category_number: 19, style_letter: "B", type: "lager", og_min: 1.048, og_max: 1.054, fg_min: 1.011, fg_max: 1.014, ibu_min: 30, ibu_max: 45, srm_min: 9, srm_max: 14, abv_min: 4.5, abv_max: 5.5 },
  { name: "American Brown Ale", category: "Amber and Brown American Beer", category_number: 19, style_letter: "C", type: "ale", og_min: 1.045, og_max: 1.060, fg_min: 1.010, fg_max: 1.016, ibu_min: 20, ibu_max: 30, srm_min: 18, srm_max: 35, abv_min: 4.3, abv_max: 6.2 },

  // 20. American Porter and Stout
  { name: "American Porter", category: "American Porter and Stout", category_number: 20, style_letter: "A", type: "ale", og_min: 1.050, og_max: 1.070, fg_min: 1.012, fg_max: 1.018, ibu_min: 25, ibu_max: 50, srm_min: 22, srm_max: 40, abv_min: 4.8, abv_max: 6.5 },
  { name: "American Stout", category: "American Porter and Stout", category_number: 20, style_letter: "B", type: "ale", og_min: 1.050, og_max: 1.075, fg_min: 1.010, fg_max: 1.022, ibu_min: 35, ibu_max: 75, srm_min: 30, srm_max: 40, abv_min: 5, abv_max: 7 },
  { name: "Imperial Stout", category: "American Porter and Stout", category_number: 20, style_letter: "C", type: "ale", og_min: 1.075, og_max: 1.115, fg_min: 1.018, fg_max: 1.030, ibu_min: 50, ibu_max: 90, srm_min: 30, srm_max: 40, abv_min: 8, abv_max: 12 },

  // 21. IPA
  { name: "American IPA", category: "IPA", category_number: 21, style_letter: "A", type: "ale", og_min: 1.056, og_max: 1.070, fg_min: 1.008, fg_max: 1.014, ibu_min: 40, ibu_max: 70, srm_min: 6, srm_max: 14, abv_min: 5.5, abv_max: 7.5 },
  { name: "Belgian IPA", category: "IPA", category_number: 21, style_letter: "B", type: "ale", og_min: 1.058, og_max: 1.080, fg_min: 1.008, fg_max: 1.016, ibu_min: 50, ibu_max: 100, srm_min: 5, srm_max: 8, abv_min: 6.2, abv_max: 9.5, notes: "21B sub-style: Belgian IPA." },
  { name: "Black IPA", category: "IPA", category_number: 21, style_letter: "B", type: "ale", og_min: 1.050, og_max: 1.085, fg_min: 1.010, fg_max: 1.018, ibu_min: 50, ibu_max: 90, srm_min: 25, srm_max: 40, abv_min: 5.5, abv_max: 9, notes: "21B sub-style: Black IPA." },
  { name: "Brown IPA", category: "IPA", category_number: 21, style_letter: "B", type: "ale", og_min: 1.056, og_max: 1.070, fg_min: 1.008, fg_max: 1.016, ibu_min: 40, ibu_max: 70, srm_min: 18, srm_max: 35, abv_min: 5.5, abv_max: 7.5, notes: "21B sub-style: Brown IPA." },
  { name: "Brut IPA", category: "IPA", category_number: 21, style_letter: "B", type: "ale", og_min: 1.046, og_max: 1.057, fg_min: 0.99, fg_max: 1.004, ibu_min: 20, ibu_max: 30, srm_min: 2, srm_max: 4, abv_min: 6, abv_max: 7.5, notes: "21B sub-style: Brut IPA — bone-dry, champagne-like." },
  { name: "Red IPA", category: "IPA", category_number: 21, style_letter: "B", type: "ale", og_min: 1.056, og_max: 1.070, fg_min: 1.008, fg_max: 1.016, ibu_min: 40, ibu_max: 70, srm_min: 11, srm_max: 17, abv_min: 5.5, abv_max: 7.5, notes: "21B sub-style: Red IPA." },
  { name: "Rye IPA", category: "IPA", category_number: 21, style_letter: "B", type: "ale", og_min: 1.056, og_max: 1.075, fg_min: 1.008, fg_max: 1.014, ibu_min: 50, ibu_max: 75, srm_min: 6, srm_max: 14, abv_min: 5.5, abv_max: 8, notes: "21B sub-style: Rye IPA." },
  { name: "White IPA", category: "IPA", category_number: 21, style_letter: "B", type: "ale", og_min: 1.056, og_max: 1.065, fg_min: 1.010, fg_max: 1.016, ibu_min: 40, ibu_max: 70, srm_min: 5, srm_max: 6, abv_min: 5.5, abv_max: 7, notes: "21B sub-style: White IPA — IPA × witbier crossover." },
  { name: "Hazy IPA", category: "IPA", category_number: 21, style_letter: "C", type: "ale", og_min: 1.060, og_max: 1.085, fg_min: 1.010, fg_max: 1.015, ibu_min: 25, ibu_max: 60, srm_min: 3, srm_max: 7, abv_min: 6, abv_max: 9, notes: "Also called New England IPA / NEIPA." },

  // 22. Strong American Ale
  { name: "Double IPA", category: "Strong American Ale", category_number: 22, style_letter: "A", type: "ale", og_min: 1.065, og_max: 1.085, fg_min: 1.008, fg_max: 1.018, ibu_min: 60, ibu_max: 100, srm_min: 6, srm_max: 14, abv_min: 7.5, abv_max: 10 },
  { name: "American Strong Ale", category: "Strong American Ale", category_number: 22, style_letter: "B", type: "ale", og_min: 1.062, og_max: 1.090, fg_min: 1.014, fg_max: 1.024, ibu_min: 50, ibu_max: 100, srm_min: 7, srm_max: 18, abv_min: 6.3, abv_max: 10 },
  { name: "American Barleywine", category: "Strong American Ale", category_number: 22, style_letter: "C", type: "ale", og_min: 1.080, og_max: 1.120, fg_min: 1.016, fg_max: 1.030, ibu_min: 50, ibu_max: 100, srm_min: 10, srm_max: 19, abv_min: 8, abv_max: 12 },
  { name: "Wheatwine", category: "Strong American Ale", category_number: 22, style_letter: "D", type: "wheat", og_min: 1.080, og_max: 1.120, fg_min: 1.016, fg_max: 1.030, ibu_min: 30, ibu_max: 60, srm_min: 8, srm_max: 15, abv_min: 8, abv_max: 12 },

  // 23. European Sour Ale
  { name: "Berliner Weisse", category: "European Sour Ale", category_number: 23, style_letter: "A", type: "wild", og_min: 1.028, og_max: 1.032, fg_min: 1.003, fg_max: 1.006, ibu_min: 3, ibu_max: 8, srm_min: 2, srm_max: 3, abv_min: 2.8, abv_max: 3.8 },
  { name: "Flanders Red Ale", category: "European Sour Ale", category_number: 23, style_letter: "B", type: "wild", og_min: 1.048, og_max: 1.057, fg_min: 1.002, fg_max: 1.012, ibu_min: 10, ibu_max: 25, srm_min: 10, srm_max: 16, abv_min: 4.6, abv_max: 6.5 },
  { name: "Oud Bruin", category: "European Sour Ale", category_number: 23, style_letter: "C", type: "wild", og_min: 1.040, og_max: 1.074, fg_min: 1.008, fg_max: 1.012, ibu_min: 20, ibu_max: 25, srm_min: 15, srm_max: 22, abv_min: 4, abv_max: 8 },
  { name: "Lambic", category: "European Sour Ale", category_number: 23, style_letter: "D", type: "wild", og_min: 1.040, og_max: 1.054, fg_min: 1.001, fg_max: 1.010, ibu_min: 0, ibu_max: 10, srm_min: 3, srm_max: 7, abv_min: 5, abv_max: 6.5 },
  { name: "Gueuze", category: "European Sour Ale", category_number: 23, style_letter: "E", type: "wild", og_min: 1.040, og_max: 1.060, fg_min: 1.000, fg_max: 1.006, ibu_min: 0, ibu_max: 10, srm_min: 3, srm_max: 7, abv_min: 5, abv_max: 8 },
  { name: "Fruit Lambic", category: "European Sour Ale", category_number: 23, style_letter: "F", type: "wild", og_min: 1.040, og_max: 1.060, fg_min: 1.000, fg_max: 1.010, ibu_min: 0, ibu_max: 10, srm_min: 3, srm_max: 7, abv_min: 5, abv_max: 7 },

  // 24. Belgian Ale
  { name: "Witbier", category: "Belgian Ale", category_number: 24, style_letter: "A", type: "wheat", og_min: 1.044, og_max: 1.052, fg_min: 1.008, fg_max: 1.012, ibu_min: 8, ibu_max: 20, srm_min: 2, srm_max: 4, abv_min: 4.5, abv_max: 5.5 },
  { name: "Belgian Pale Ale", category: "Belgian Ale", category_number: 24, style_letter: "B", type: "ale", og_min: 1.048, og_max: 1.054, fg_min: 1.010, fg_max: 1.014, ibu_min: 20, ibu_max: 30, srm_min: 8, srm_max: 14, abv_min: 4.8, abv_max: 5.5 },
  { name: "Bière de Garde", category: "Belgian Ale", category_number: 24, style_letter: "C", type: "ale", og_min: 1.060, og_max: 1.080, fg_min: 1.008, fg_max: 1.016, ibu_min: 18, ibu_max: 28, srm_min: 6, srm_max: 19, abv_min: 6, abv_max: 8.5 },

  // 25. Strong Belgian Ale
  { name: "Belgian Blond Ale", category: "Strong Belgian Ale", category_number: 25, style_letter: "A", type: "ale", og_min: 1.062, og_max: 1.075, fg_min: 1.008, fg_max: 1.018, ibu_min: 15, ibu_max: 30, srm_min: 4, srm_max: 6, abv_min: 6, abv_max: 7.5 },
  { name: "Saison", category: "Strong Belgian Ale", category_number: 25, style_letter: "B", type: "ale", og_min: 1.048, og_max: 1.065, fg_min: 1.002, fg_max: 1.008, ibu_min: 20, ibu_max: 35, srm_min: 5, srm_max: 14, abv_min: 5, abv_max: 7 },
  { name: "Belgian Golden Strong Ale", category: "Strong Belgian Ale", category_number: 25, style_letter: "C", type: "ale", og_min: 1.070, og_max: 1.095, fg_min: 1.005, fg_max: 1.016, ibu_min: 22, ibu_max: 35, srm_min: 3, srm_max: 6, abv_min: 7.5, abv_max: 10.5 },

  // 26. Trappist Ale
  { name: "Belgian Single", category: "Trappist Ale", category_number: 26, style_letter: "A", type: "ale", og_min: 1.044, og_max: 1.054, fg_min: 1.004, fg_max: 1.010, ibu_min: 25, ibu_max: 45, srm_min: 3, srm_max: 5, abv_min: 4.8, abv_max: 6 },
  { name: "Belgian Dubbel", category: "Trappist Ale", category_number: 26, style_letter: "B", type: "ale", og_min: 1.062, og_max: 1.075, fg_min: 1.008, fg_max: 1.018, ibu_min: 15, ibu_max: 25, srm_min: 10, srm_max: 17, abv_min: 6, abv_max: 7.6 },
  { name: "Belgian Tripel", category: "Trappist Ale", category_number: 26, style_letter: "C", type: "ale", og_min: 1.075, og_max: 1.085, fg_min: 1.008, fg_max: 1.014, ibu_min: 20, ibu_max: 40, srm_min: 4.5, srm_max: 7, abv_min: 7.5, abv_max: 9.5 },
  { name: "Belgian Dark Strong Ale", category: "Trappist Ale", category_number: 26, style_letter: "D", type: "ale", og_min: 1.075, og_max: 1.110, fg_min: 1.010, fg_max: 1.024, ibu_min: 20, ibu_max: 35, srm_min: 12, srm_max: 22, abv_min: 8, abv_max: 12 },

  // 27. Historical Beer
  { name: "Sahti", category: "Historical Beer", category_number: 27, style_letter: "A", type: "ale", og_min: 1.076, og_max: 1.120, fg_min: 1.016, fg_max: 1.038, ibu_min: 0, ibu_max: 15, srm_min: 4, srm_max: 22, abv_min: 7, abv_max: 11, notes: "Finnish farmhouse — juniper, rye." },
];
