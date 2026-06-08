/**
 * Lightweight i18n.
 *
 * No runtime dependency, no namespace gymnastics: just a flat dict
 * keyed by `screen.element` strings, mapped to per-locale entries.
 * Translation lookup is O(1); missing keys fall back to English and
 * log a console warning so dev-time gaps are visible.
 *
 * Variable interpolation uses `{name}` placeholders — `t("brew.elapsed",
 * { time: "5:23" })` → "5:23 elapsed" / "5:23 écoulées".
 *
 * Adding a locale: add it to `Locale`, extend each STRINGS entry with
 * the new key, append to `SUPPORTED_LOCALES` for the Settings picker.
 */

export type Locale = "en" | "fr";

export const SUPPORTED_LOCALES: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

/**
 * Detect the brewer's preferred locale from the browser. Used once on
 * first launch as the seed for UnitPreferences.locale. After that, the
 * stored preference wins and this isn't consulted.
 */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.toLowerCase() ?? "";
  if (lang.startsWith("fr")) return "fr";
  return "en";
}

/**
 * Map an internal locale to a BCP-47 tag for `Intl` / `toLocaleString`.
 * Used by every date / time formatter so output respects the user's
 * Settings choice rather than the OS locale.
 */
export function bcp47(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

interface Entry {
  en: string;
  fr: string;
}

// Flat key → per-locale text. Grouped visually by screen / area for
// readability; the dot-notation keys are arbitrary strings as far as
// the translator is concerned.
const STRINGS: Record<string, Entry> = {
  // ─── Common ────────────────────────────────────────────────────
  "common.save": { en: "Save", fr: "Enregistrer" },
  "common.cancel": { en: "Cancel", fr: "Annuler" },
  "common.delete": { en: "Delete", fr: "Supprimer" },
  "common.edit": { en: "Edit", fr: "Modifier" },
  "common.remove": { en: "Remove", fr: "Retirer" },
  "common.close": { en: "Close", fr: "Fermer" },
  "common.back": { en: "Back", fr: "Retour" },
  "common.loading": { en: "Loading…", fr: "Chargement…" },
  "common.try_again": { en: "Try again", fr: "Réessayer" },
  "common.reload": { en: "Reload", fr: "Recharger" },

  // ─── ErrorBoundary recovery screen ─────────────────────────────
  "error.boundary.eyebrow": {
    en: "Something went wrong",
    fr: "Une erreur est survenue",
  },
  "error.boundary.title": {
    en: "Werb hit an unexpected error",
    fr: "Werb a rencontré une erreur inattendue",
  },
  "error.boundary.body": {
    en: "Your data is safe — nothing is saved automatically when a render fails. Try again, or reload if it persists.",
    fr: "Vos données sont en sécurité — rien n'est enregistré automatiquement lors d'une erreur d'affichage. Réessayez, ou rechargez si le problème persiste.",
  },
  "error.boundary.report_prefix": {
    en: "If this keeps happening,",
    fr: "Si cela persiste,",
  },
  "error.boundary.report_link": {
    en: "file an issue",
    fr: "ouvrez un ticket",
  },
  "error.boundary.report_suffix": {
    en: "and include the message above.",
    fr: "en incluant le message ci-dessus.",
  },

  // ─── Navigation (DevNav) ──────────────────────────────────────
  "nav.library": { en: "Library", fr: "Bibliothèque" },
  "nav.journal": { en: "Journal", fr: "Journal" },
  "nav.equipment": { en: "Equipment", fr: "Matériel" },
  "nav.settings": { en: "Settings", fr: "Réglages" },
  "nav.tokens": { en: "Tokens", fr: "Tokens" },

  // ─── Library ───────────────────────────────────────────────────
  "library.title": { en: "Library", fr: "Bibliothèque" },
  "library.delete_confirm": {
    en: 'Delete "{name}"?',
    fr: "Supprimer « {name} » ?",
  },
  "library.duplicated_name": {
    en: "{name} (copy)",
    fr: "{name} (copie)",
  },
  "library.no_profile_prompt": {
    en: "No equipment profile yet — the new recipe will use generic defaults (20 L, 75 % efficiency).\n\nSet up your equipment profile first? (Cancel to continue with defaults.)",
    fr: "Aucun profil de matériel — la nouvelle recette utilisera des valeurs par défaut génériques (20 L, 75 % d'efficacité).\n\nConfigurer votre profil de matériel d'abord ? (Annuler pour continuer avec les valeurs par défaut.)",
  },
  "library.subtitle_loading": { en: "Werb · loading…", fr: "Werb · chargement…" },
  "library.subtitle_count": { en: "Werb · {count} recipe{s}", fr: "Werb · {count} recette{s}" },
  "library.new_recipe": { en: "+ New recipe", fr: "+ Nouvelle recette" },
  "library.import_recipes": { en: "Import recipes", fr: "Importer des recettes" },
  "library.import_formats_help": {
    en: "Accepts BeerJSON 2.x, BeerXML 1.0 (incl. joliebulle v3 exports), and joliebulle v4 library exports.",
    fr: "Accepte BeerJSON 2.x, BeerXML 1.0 (y compris les exports joliebulle v3) et les exports de bibliothèque joliebulle v4.",
  },
  "library.importing": { en: "Importing…", fr: "Import en cours…" },
  "library.import_samples": { en: "Import samples", fr: "Importer des exemples" },
  "library.search_placeholder": { en: "Search recipes…", fr: "Rechercher des recettes…" },
  "library.sort_updated": { en: "Recently updated", fr: "Récemment modifié" },
  "library.sort_name": { en: "Name (A→Z)", fr: "Nom (A→Z)" },
  "library.sort_style": { en: "Style", fr: "Style" },
  "library.no_match": { en: "No recipes match \"{query}\".", fr: "Aucune recette ne correspond à « {query} »." },
  "library.import_failed": { en: "Import failed", fr: "Échec de l'import" },
  "library.import_notice": { en: "Import notice", fr: "Information d'import" },
  "library.profile_default": { en: "No equipment profile — using defaults", fr: "Pas de profil de matériel — valeurs par défaut" },
  "library.card.duplicate_title": { en: "Duplicate recipe", fr: "Dupliquer la recette" },
  "library.card.delete_title": { en: "Delete recipe", fr: "Supprimer la recette" },
  "library.card.duplicate_aria": { en: "Duplicate {name}", fr: "Dupliquer {name}" },
  "library.card.delete_aria": { en: "Delete {name}", fr: "Supprimer {name}" },
  "library.card.stat.vol": { en: "Vol", fr: "Vol" },
  "library.card.stat.og": { en: "OG", fr: "OG" },
  "library.card.stat.abv": { en: "ABV", fr: "ABV" },
  "library.card.stat.ibu": { en: "IBU", fr: "IBU" },
  "library.card.stat.fg": { en: "FG", fr: "FG" },
  "library.card.stat.water": { en: "Water", fr: "Eau" },
  "library.card.water.rig": { en: "rig", fr: "matériel" },
  "library.card.water.default": { en: "default", fr: "défaut" },
  "library.profile_in_use_title": { en: "Equipment profile in use — click to edit", fr: "Profil de matériel actif — cliquez pour modifier" },
  "library.profile_brewing_on": { en: "Brewing on", fr: "Brassage sur" },
  "library.profile_eff_suffix": { en: "{eff}% eff", fr: "{eff} % eff" },

  // ─── Library onboarding ───────────────────────────────────────
  "library.onboarding.title": { en: "Welcome to Werb", fr: "Bienvenue dans Werb" },
  "library.onboarding.subtitle": {
    en: "File-driven homebrewing — recipes in, brew sessions out, everything stored on this device.",
    fr: "Brassage maison piloté par fichiers — recettes en entrée, sessions de brassage en sortie, tout est stocké sur cet appareil.",
  },
  "library.onboarding.step1.title": { en: "Add a recipe", fr: "Ajoutez une recette" },
  "library.onboarding.step1.body": {
    en: "Tap + New recipe above to start from scratch, import a .beerjson or .beerxml file, or load the bundled samples to see how it all fits together.",
    fr: "Touchez « + Nouvelle recette » pour partir de zéro, importez un fichier .beerjson ou .beerxml, ou chargez les exemples fournis pour voir comment tout s'articule.",
  },
  "library.onboarding.step2.title": { en: "Set up your equipment", fr: "Configurez votre matériel" },
  "library.onboarding.step2.body": {
    en: "Equipment in the top nav. The Quick-start wizard sizes your vessels from a target batch in one tap.",
    fr: "Matériel dans la barre de navigation. L'assistant Démarrage rapide dimensionne vos cuves à partir d'un volume cible en un toucher.",
  },
  "library.onboarding.step3.title": { en: "Brew + reflect", fr: "Brassez et analysez" },
  "library.onboarding.step3.body": {
    en: "Tap Start brewing on a recipe for a live timeline with countdowns and measurement logging. Once complete, score the result on the radar so the next brew of the same recipe learns from it.",
    fr: "Touchez « Démarrer le brassage » sur une recette pour une chronologie en direct avec comptes à rebours et relevés. Une fois terminé, notez le résultat sur le radar pour que le prochain brassage en tire les leçons.",
  },
  "library.onboarding.step4.title": { en: "Your recipes stay local", fr: "Vos recettes restent locales" },
  "library.onboarding.step4.body": {
    en: "They live on this device. Open Settings → Sync to push them to a private GitHub repo if you want them across devices — your token never leaves the browser.",
    fr: "Elles vivent sur cet appareil. Ouvrez Paramètres → Sync pour les pousser vers un dépôt GitHub privé si vous voulez les retrouver sur plusieurs appareils — votre jeton ne quitte jamais le navigateur.",
  },

  // ─── Brew ──────────────────────────────────────────────────────
  "brew.session_label": { en: "Brew session · {status}", fr: "Session de brassage · {status}" },
  "brew.started_at": { en: "Started {time}", fr: "Démarré le {time}" },
  "brew.step_elapsed": { en: "{duration} elapsed", fr: "{duration} écoulées" },
  "brew.step_finished": { en: "{duration} · finished {time}", fr: "{duration} · terminé à {time}" },
  "brew.thickness_unit": { en: "L/kg", fr: "L/kg" },
  "brew.tasting.aria_rating": { en: "Overall rating", fr: "Note globale" },
  "brew.status.draft": { en: "Draft", fr: "Brouillon" },
  "brew.status.in_progress": { en: "In progress", fr: "En cours" },
  "brew.status.completed": { en: "Completed", fr: "Terminé" },
  "brew.status.abandoned": { en: "Abandoned", fr: "Abandonné" },
  "brew.wake": { en: "WAKE", fr: "ACTIF" },
  "brew.sleep": { en: "SLEEP", fr: "VEILLE" },
  "brew.timeline": { en: "Timeline", fr: "Chronologie" },
  "brew.step.out_of_order_confirm": {
    en: "Earlier steps haven't been started yet. Start this one anyway?",
    fr: "Des étapes précédentes n'ont pas été démarrées. Lancer celle-ci quand même ?",
  },
  "brew.measurements": { en: "Measurements", fr: "Mesures" },
  "brew.tasting": { en: "Tasting", fr: "Dégustation" },
  "brew.mark_done": { en: "Mark done", fr: "Marquer terminée" },
  "brew.start_step": { en: "Start", fr: "Démarrer" },
  "brew.done_step": { en: "Done", fr: "Terminé" },
  "brew.complete_session": { en: "Complete session", fr: "Terminer la session" },
  "brew.discard_session": { en: "Discard session", fr: "Annuler la session" },
  "brew.discard_confirm": {
    en: "Discard this brew session? All progress and notes will be lost.",
    fr: "Annuler cette session de brassage ? Toute la progression et les notes seront perdues.",
  },
  "brew.session_completed": { en: "Brew session completed.", fr: "Session de brassage terminée." },
  "brew.view_in_journal": { en: "View in Journal", fr: "Voir dans le Journal" },
  "brew.no_session.heading": { en: "Ready to brew?", fr: "Prêt à brasser ?" },
  "brew.no_session.body": {
    en: "A new session will start now and the screen will stay awake until you finish.",
    fr: "Une nouvelle session va démarrer et l'écran restera allumé jusqu'à la fin.",
  },
  "brew.no_session.start": { en: "Start brewing", fr: "Démarrer le brassage" },
  "brew.no_session.back": { en: "Back to recipe", fr: "Retour à la recette" },
  "brew.start_hint": {
    en: "Tap {start} on a step to begin.",
    fr: "Touchez {start} sur une étape pour commencer.",
  },
  "brew.completed_label": { en: "Brew completed", fr: "Brassage terminé" },
  "brew.total_brew_time": { en: "total brew time", fr: "temps total de brassage" },

  // ─── Recipe screen ─────────────────────────────────────────────
  "recipe.back_library": { en: "Library", fr: "Bibliothèque" },
  "brew.back_recipe": { en: "Recipe", fr: "Recette" },
  "brew.back_journal": { en: "Journal", fr: "Journal" },
  "recipe.start_brewing": { en: "Start brewing →", fr: "Démarrer le brassage →" },
  "recipe.resume_brewing": { en: "Resume brewing →", fr: "Reprendre le brassage →" },
  "recipe.edit": { en: "Edit recipe", fr: "Modifier la recette" },
  "recipe.section.water": { en: "Water volumes", fr: "Volumes d'eau" },
  "recipe.section.fermentables": { en: "Fermentables", fr: "Fermentescibles" },

  // ─── BeerJSON enum translations ────────────────────────────────
  // Rendered on the Recipe view, the Brew screen's culture / mash
  // panels, and the editor's enum pickers + catalog typeahead.
  // Values match BeerJSON 2.x; the lookup helper in components
  // ./Recipe/enums.ts collapses " " → "_" so "all grain" works.
  "enum.fermentable.grain": { en: "grain", fr: "grain" },
  "enum.fermentable.sugar": { en: "sugar", fr: "sucre" },
  "enum.fermentable.extract": { en: "extract", fr: "extrait" },
  "enum.fermentable.dry_extract": { en: "dry extract", fr: "extrait sec" },
  "enum.fermentable.fruit": { en: "fruit", fr: "fruit" },
  "enum.fermentable.juice": { en: "juice", fr: "jus" },
  "enum.fermentable.honey": { en: "honey", fr: "miel" },
  "enum.fermentable.other": { en: "other", fr: "autre" },
  "enum.hop_form.pellet": { en: "pellet", fr: "pellet" },
  "enum.hop_form.leaf": { en: "leaf", fr: "fleur" },
  "enum.hop_form.leaf_wet": { en: "leaf (wet)", fr: "fleur fraîche" },
  "enum.hop_form.plug": { en: "plug", fr: "plug" },
  "enum.hop_form.extract": { en: "extract", fr: "extrait" },
  "enum.hop_form.powder": { en: "powder", fr: "poudre" },
  "enum.culture_form.liquid": { en: "liquid", fr: "liquide" },
  "enum.culture_form.dry": { en: "dry", fr: "sèche" },
  "enum.culture_form.slant": { en: "slant", fr: "gélose" },
  "enum.culture_form.culture": { en: "culture", fr: "culture" },
  "enum.culture_form.dregs": { en: "dregs", fr: "lie" },
  "enum.culture_type.ale": { en: "ale", fr: "ale" },
  "enum.culture_type.lager": { en: "lager", fr: "lager" },
  "enum.culture_type.wheat": { en: "wheat", fr: "blé" },
  "enum.culture_type.wild": { en: "wild", fr: "sauvage" },
  "enum.culture_type.kveik": { en: "kveik", fr: "kveik" },
  "enum.culture_type.lacto": { en: "lacto", fr: "lacto" },
  "enum.culture_type.pedio": { en: "pedio", fr: "pédio" },
  "enum.culture_type.brett": { en: "brett", fr: "brett" },
  "enum.culture_type.mixed_culture": { en: "mixed culture", fr: "culture mixte" },
  "enum.culture_type.champagne": { en: "champagne", fr: "champagne" },
  "enum.culture_type.wine": { en: "wine", fr: "vin" },
  "enum.culture_type.bacteria": { en: "bacteria", fr: "bactérie" },
  "enum.culture_type.malolactic": { en: "malolactic", fr: "malolactique" },
  "enum.culture_type.spontaneous": { en: "spontaneous", fr: "spontanée" },
  "enum.culture_type.other": { en: "other", fr: "autre" },
  "enum.misc_type.spice": { en: "spice", fr: "épice" },
  "enum.misc_type.fining": { en: "fining", fr: "clarifiant" },
  "enum.misc_type.water_agent": { en: "water agent", fr: "agent d'eau" },
  "enum.misc_type.herb": { en: "herb", fr: "herbe" },
  "enum.misc_type.flavor": { en: "flavor", fr: "arôme" },
  "enum.misc_type.wood": { en: "wood", fr: "bois" },
  "enum.misc_type.other": { en: "other", fr: "autre" },
  "recipe.section.hops": { en: "Hop additions", fr: "Houblonnage" },
  "recipe.header.boil_min": { en: "{min} min boil", fr: "ébullition {min} min" },
  "recipe.header.efficiency": { en: "{pct}% efficiency", fr: "{pct} % d'efficacité" },
  "recipe.hop.alpha_acid": { en: "{pct}% AA", fr: "{pct} % AA" },
  "recipe.culture.attenuation": { en: "{pct}% atten", fr: "{pct} % d'atténuation" },
  "recipe.time.days": { en: "{n} day", fr: "{n} jour" },
  "recipe.time.minutes": { en: "{n} min", fr: "{n} min" },
  "recipe.mash.infusion": { en: "{volume} infusion", fr: "infusion {volume}" },
  // BeerJSON 2.x MashStepKind enum (drives the mash-step type pill
  // shown under each step on the Recipe view).
  "recipe.mash.type.infusion": { en: "Infusion", fr: "Infusion" },
  "recipe.mash.type.temperature": { en: "Temperature", fr: "Palier de température" },
  "recipe.mash.type.decoction": { en: "Decoction", fr: "Décoction" },
  // BeerJSON 2.x RecipeType — `type.replace(" ", "_")` collapses
  // "all grain" / "partial mash" to underscore form for the lookup.
  "recipe.type.all_grain": { en: "all grain", fr: "tout grain" },
  "recipe.type.extract": { en: "extract", fr: "extrait" },
  "recipe.type.partial_mash": { en: "partial mash", fr: "empâtage partiel" },
  "recipe.type.cider": { en: "cider", fr: "cidre" },
  "recipe.type.kombucha": { en: "kombucha", fr: "kombucha" },
  "recipe.type.soda": { en: "soda", fr: "soda" },
  "recipe.type.mead": { en: "mead", fr: "hydromel" },
  "recipe.type.wine": { en: "wine", fr: "vin" },
  "recipe.type.other": { en: "other", fr: "autre" },
  "recipe.section.hops_subtitle": {
    en: "Boil hops contribute IBU. Dry hops are listed for reference.",
    fr: "Les houblons d'ébullition contribuent aux IBU. Les houblons à cru sont listés pour référence.",
  },
  "recipe.section.miscs": { en: "Miscellaneous", fr: "Divers" },
  "recipe.section.mash": { en: "Mash schedule", fr: "Programme d'empâtage" },
  "recipe.section.cultures": { en: "Cultures", fr: "Levures" },
  "recipe.section.cost": { en: "Cost", fr: "Coût" },
  "recipe.section.tasting": { en: "Last tasting", fr: "Dernière dégustation" },
  "recipe.tasting.most_recent_of": {
    en: "Most recent of {count} tastings across this recipe",
    fr: "La plus récente parmi {count} dégustations de cette recette",
  },
  "recipe.section.carbonation": { en: "Carbonation", fr: "Carbonatation" },
  "recipe.export": { en: "Export", fr: "Exporter" },

  // ─── Journal ───────────────────────────────────────────────────
  "journal.title": { en: "Journal", fr: "Journal" },
  "journal.subtitle_loading": { en: "Werb · loading…", fr: "Werb · chargement…" },
  "journal.subtitle_count": { en: "Werb · {count} brew{s}", fr: "Werb · {count} brassage{s}" },
  "journal.body": {
    en: "Every brew session you've started. Tap one to revisit its timeline, measurements and notes.",
    fr: "Toutes les sessions de brassage. Touchez-en une pour revoir sa chronologie, ses mesures et ses notes.",
  },
  "journal.empty": { en: "No brews yet.", fr: "Aucun brassage pour le moment." },
  "journal.empty_hint": {
    en: "Open a recipe and tap Start brewing to log your first session. It'll show up here once you do.",
    fr: "Ouvrez une recette et touchez « Démarrer le brassage » pour enregistrer votre première session. Elle apparaîtra ici.",
  },
  "journal.counts": {
    en: "{in_progress} in progress · {completed} completed",
    fr: "{in_progress} en cours · {completed} terminée(s)",
  },
  "journal.could_not_load": { en: "Could not load brew log", fr: "Impossible de charger le journal de brassage" },
  "journal.row.steps": { en: "{count} step{s}", fr: "{count} étape{s}" },
  "journal.row.steps_progress": { en: "{done}/{total} steps", fr: "{done}/{total} étapes" },
  "journal.row.readings": { en: "{count} reading{s}", fr: "{count} relevé{s}" },
  "journal.row.untitled_recipe": { en: "Untitled recipe", fr: "Recette sans nom" },
  "journal.status.draft": { en: "Draft", fr: "Brouillon" },
  "journal.status.active": { en: "Active", fr: "Actif" },
  "journal.status.done": { en: "Done", fr: "Terminé" },
  "journal.status.abandoned": { en: "Abandoned", fr: "Abandonné" },
  "journal.export.aria": { en: "Export this brew log", fr: "Exporter ce journal" },
  "journal.export.html_label": { en: "Printable HTML / PDF", fr: "HTML / PDF imprimable" },
  "journal.export.html_sub": { en: "Open in any browser, print to PDF", fr: "À ouvrir dans n'importe quel navigateur, imprimable en PDF" },
  "journal.export.json_label": { en: "JSON", fr: "JSON" },
  "journal.export.json_sub": { en: "Full session data — steps, measurements, notes", fr: "Données complètes — étapes, mesures, notes" },
  "journal.duration.minutes": { en: "{n} min", fr: "{n} min" },
  "journal.duration.hours": { en: "{h} h", fr: "{h} h" },
  "journal.duration.hours_minutes": { en: "{h} h {m} min", fr: "{h} h {m} min" },

  // ─── Settings ─────────────────────────────────────────────────
  "settings.title": { en: "Sync & storage", fr: "Synchronisation et stockage" },
  "settings.subtitle": { en: "Werb · settings", fr: "Werb · réglages" },
  "settings.intro": {
    en: "Keep recipes, equipment profiles, and brew sessions in sync across devices via a private GitHub repo. Manual push / pull in v1 — no background sync.",
    fr: "Gardez recettes, profils de matériel et sessions de brassage synchronisés entre appareils via un dépôt GitHub privé. Push / pull manuel en v1 — pas de synchronisation en arrière-plan.",
  },
  "settings.build_stamp": {
    en: "Werb {version} · {commit} · built {date}",
    fr: "Werb {version} · {commit} · compilé le {date}",
  },
  "settings.section.units": { en: "Units", fr: "Unités" },
  "settings.section.github": { en: "GitHub sync", fr: "Synchronisation GitHub" },
  "settings.section.data": { en: "Data", fr: "Données" },
  "settings.units.intro": {
    en: "Display-only. The editor and stored data are unchanged — these preferences just change how recipes and brew screens render numbers.",
    fr: "Affichage uniquement. L'éditeur et les données stockées restent inchangés — ces préférences modifient seulement l'affichage des nombres.",
  },
  "settings.units.temperature": { en: "Temperature", fr: "Température" },
  "settings.units.volume": { en: "Volume", fr: "Volume" },
  "settings.units.mass": { en: "Mass", fr: "Masse" },
  "settings.units.gravity": { en: "Gravity", fr: "Densité" },
  "settings.units.color": { en: "Color", fr: "Couleur" },
  "settings.units.ibu_method": { en: "IBU formula", fr: "Formule IBU" },
  "settings.units.color_method": { en: "Color formula", fr: "Formule de couleur" },
  "settings.units.currency": { en: "Currency", fr: "Devise" },
  "settings.units.cost_adjustment": { en: "Cost adjustment", fr: "Ajustement des coûts" },
  "settings.units.cost_adjustment_hint": {
    en: "Scales the bundled ingredient prices used on the recipe Cost section. 100% = the EUR baseline. Bump to 110-130 if your local supplier is pricier; dial down for bulk / co-op pricing.",
    fr: "Ajuste les prix d'ingrédients groupés utilisés dans la section Coût. 100 % = référence EUR. Montez à 110-130 si votre fournisseur est plus cher localement, baissez pour des prix en gros / coopérative.",
  },
  "settings.units.language": { en: "Language", fr: "Langue" },
  "settings.units.theme": { en: "Theme", fr: "Thème" },
  "settings.units.opt.theme_auto": { en: "Auto", fr: "Auto" },
  "settings.units.opt.theme_dark": { en: "Dark", fr: "Sombre" },
  "settings.units.opt.theme_light": { en: "Light", fr: "Clair" },
  "settings.privacy.title": { en: "Data & privacy", fr: "Données et confidentialité" },
  "settings.privacy.subtitle": { en: "How Werb handles your data.", fr: "Comment Werb traite vos données." },
  "settings.privacy.local": {
    en: "Local-first. Recipes, equipment profiles, brew sessions, and tastings are stored in your browser's private file system (OPFS) on the web build, or in the app-data directory on the desktop build. Nothing is uploaded unless you explicitly turn on GitHub sync above.",
    fr: "Local d'abord. Recettes, profils de matériel, sessions de brassage et dégustations sont stockés dans le système de fichiers privé de votre navigateur (OPFS) sur le build web, ou dans le dossier app-data du build desktop. Rien n'est envoyé tant que vous n'activez pas la synchronisation GitHub ci-dessus.",
  },
  "settings.privacy.optin": {
    en: "GitHub sync is opt-in. Your Personal Access Token is stored on this device and never leaves it for any purpose other than the Push / Pull requests you trigger. Tokens are kept in a separate, non-synced slot so they're never copied into the synced repo.",
    fr: "La synchronisation GitHub est facultative. Votre Personal Access Token est stocké sur cet appareil et ne le quitte jamais, sauf pour les requêtes Push / Pull que vous déclenchez. Les tokens sont conservés à part, hors synchronisation, pour ne jamais être copiés dans le dépôt.",
  },
  "settings.privacy.telemetry": {
    en: "No telemetry, no analytics. Werb makes no network requests on its own. The web build is a static PWA; the desktop build runs entirely offline.",
    fr: "Pas de télémétrie, pas d'analytique. Werb ne fait aucune requête réseau par lui-même. Le build web est une PWA statique ; le build desktop fonctionne entièrement hors ligne.",
  },
  "settings.privacy.source": { en: "Source code", fr: "Code source" },

  // ─── Settings — unit option labels ───────────────────────────
  "settings.units.opt.liters": { en: "Liters", fr: "Litres" },
  "settings.units.opt.us_gallons": { en: "US gallons", fr: "Gallons US" },
  "settings.units.opt.kg_g": { en: "kg / g", fr: "kg / g" },
  "settings.units.opt.lb_oz": { en: "lb / oz", fr: "lb / oz" },
  "settings.units.opt.sg": { en: "Specific gravity (1.052)", fr: "Densité (1,052)" },
  "settings.units.opt.plato": { en: "Plato (12.9 °P)", fr: "Plato (12,9 °P)" },
  "settings.units.opt.eur": { en: "€ Euro", fr: "€ Euro" },
  "settings.units.opt.usd": { en: "$ US dollar", fr: "$ Dollar US" },
  "settings.units.opt.gbp": { en: "£ Pound sterling", fr: "£ Livre sterling" },
  "settings.units.opt.ibu_tinseth": {
    en: "Tinseth (default)",
    fr: "Tinseth (défaut)",
  },
  "settings.units.opt.ibu_rager": {
    en: "Rager (higher at long boils)",
    fr: "Rager (plus élevé sur longues ébullitions)",
  },
  "settings.units.opt.color_morey": {
    en: "Morey (default)",
    fr: "Morey (défaut)",
  },
  "settings.units.opt.color_daniels": {
    en: "Daniels (tuned for darker beers)",
    fr: "Daniels (calibré pour les bières foncées)",
  },

  // ─── Settings — Data card ────────────────────────────────────
  "settings.data.intro": {
    en: "Export a JSON backup of your recipes, equipment, and brew sessions — or wipe everything for a fresh start. Unit preferences and sync settings are stored separately and aren't touched by these actions.",
    fr: "Exportez une sauvegarde JSON de vos recettes, équipements et sessions — ou effacez tout pour repartir à zéro. Les préférences d'unités et de synchronisation sont stockées à part et ne sont pas affectées.",
  },
  "settings.data.stats.recipes": { en: "{count} recipe{s}", fr: "{count} recette{s}" },
  "settings.data.stats.equipment": { en: "{count} equipment profile{s}", fr: "{count} profil{s} de matériel" },
  "settings.data.stats.sessions": { en: "{count} brew session{s}", fr: "{count} session{s} de brassage" },
  "settings.data.stats.other": { en: "{count} other", fr: "{count} autres" },
  "settings.data.working": { en: "Working…", fr: "En cours…" },
  "settings.data.export": { en: "Export backup", fr: "Exporter la sauvegarde" },
  "settings.data.restore": { en: "Restore from file", fr: "Restaurer depuis un fichier" },
  "settings.data.clear": { en: "Clear all data", fr: "Effacer toutes les données" },
  "settings.data.confirm_clear": {
    en: "Delete every recipe, equipment profile, and brew session?\n\nUnit preferences and your GitHub sync settings are NOT affected. Export a backup first if you might want to undo this.",
    fr: "Supprimer toutes les recettes, profils de matériel et sessions de brassage ?\n\nLes préférences d'unités et la synchronisation GitHub NE sont PAS affectées. Exportez d'abord une sauvegarde si vous voulez pouvoir annuler.",
  },
  "settings.data.error.bad_json": { en: "That file isn't valid JSON.", fr: "Ce fichier n'est pas un JSON valide." },
  "settings.data.error.not_werb": { en: "That file isn't a Werb backup.", fr: "Ce fichier n'est pas une sauvegarde Werb." },
  "settings.data.exported": { en: "Exported {count} item{s} to {filename}.", fr: "{count} élément{s} exporté{s} vers {filename}." },
  "settings.data.restored": { en: "Restored {count} item{s} from backup. Reload the app to see the changes.", fr: "{count} élément{s} restauré{s} depuis la sauvegarde. Rechargez l'app pour voir les changements." },
  "settings.data.cleared": { en: "Cleared {count} item{s}. Reload the app to see an empty state.", fr: "{count} élément{s} effacé{s}. Rechargez l'app pour voir un état vide." },

  // ─── Settings — Connect / Connected (GitHub sync) ────────────
  "settings.connect.intro_lead": { en: "Paste a Personal Access Token with", fr: "Collez un Personal Access Token avec" },
  "settings.connect.intro_scope_a": { en: "on the target repo (fine-grained) or the classic", fr: "sur le dépôt cible (fine-grained) ou le scope classique" },
  "settings.connect.intro_scope_b": { en: "scope.", fr: "." },
  "settings.connect.error.required": { en: "Token and repo are required.", fr: "Le token et le dépôt sont obligatoires." },
  "settings.connect.field.token": { en: "Token", fr: "Token" },
  "settings.connect.field.repo": { en: "Repository", fr: "Dépôt" },
  "settings.connect.field.branch": { en: "Branch", fr: "Branche" },
  "settings.connect.field.recipes_path": { en: "Recipes folder", fr: "Dossier des recettes" },
  "settings.connect.verifying": { en: "Verifying…", fr: "Vérification…" },
  "settings.connect.verify": { en: "Verify & connect", fr: "Vérifier et connecter" },
  "settings.connect.footer": {
    en: "The token sits in this browser's local storage. Use a fine-grained token scoped to one repo — that's the smallest blast radius if anything ever leaks.",
    fr: "Le token reste dans le stockage local de ce navigateur. Utilisez un token fine-grained restreint à un seul dépôt — c'est le rayon d'impact le plus petit en cas de fuite.",
  },
  "settings.connected.status_lead": { en: "Connected as", fr: "Connecté en tant que" },
  "settings.connected.status_syncing": { en: "syncing", fr: "synchronisation de" },
  "settings.connected.footer": {
    en: "Push writes every local recipe to the folder as <slug>.beerjson — one file per recipe. Pull adds any new recipe files from the folder. Renames in Werb create a new file; the old one stays until you remove it on GitHub.",
    fr: "Push écrit chaque recette locale dans le dossier sous la forme <slug>.beerjson — un fichier par recette. Pull importe les nouveaux fichiers présents dans le dossier. Renommer une recette dans Werb crée un nouveau fichier ; l'ancien reste jusqu'à suppression manuelle sur GitHub.",
  },
  "settings.connected.overwrite_on_pull": {
    en: "Overwrite local recipes that share a name with one on GitHub",
    fr: "Écraser les recettes locales qui portent le même nom qu'une recette GitHub",
  },
  "settings.connected.push": { en: "Push to GitHub", fr: "Pousser vers GitHub" },
  "settings.connected.pull": { en: "Pull from GitHub", fr: "Tirer depuis GitHub" },
  "settings.connected.working": { en: "Working…", fr: "En cours…" },
  "settings.connected.disconnect": { en: "Disconnect", fr: "Se déconnecter" },
  "settings.connected.nothing": { en: "Nothing to sync.", fr: "Rien à synchroniser." },
  "settings.connected.pushed": { en: "Pushed {count} recipe{s} to GitHub.", fr: "{count} recette{s} poussée{s} vers GitHub." },
  "settings.connected.pulled_detail": {
    en: "Pulled: {added} added, {replaced} replaced, {skipped} skipped.",
    fr: "Importé : {added} ajoutée·s, {replaced} remplacée·s, {skipped} ignorée·s.",
  },
  "settings.connected.pull_failed": {
    en: "{count} file{s} couldn't be imported: {detail}",
    fr: "{count} fichier{s} n'a/ont pas pu être importé{s} : {detail}",
  },
  "settings.connected.failed": { en: "Sync failed: {detail}", fr: "Échec de synchronisation : {detail}" },

  // ─── Recipe — export menu ────────────────────────────────────
  "recipe.export.button": { en: "Export", fr: "Exporter" },
  "recipe.export.button_formats": {
    en: "BeerJSON · BeerXML · HTML",
    fr: "BeerJSON · BeerXML · HTML",
  },
  "recipe.export.button_hint": {
    en: "Export this recipe as BeerJSON, BeerXML, or a printable HTML.",
    fr: "Exporter cette recette en BeerJSON, BeerXML ou HTML imprimable.",
  },
  "recipe.export.beerjson_label": { en: "BeerJSON (.beerjson)", fr: "BeerJSON (.beerjson)" },
  "recipe.export.beerjson_sub": { en: "Modern JSON format — round-trips cleanly with most tools.", fr: "Format JSON moderne — compatible avec la plupart des outils." },
  "recipe.export.beerxml_label": { en: "BeerXML (.xml)", fr: "BeerXML (.xml)" },
  "recipe.export.beerxml_sub": { en: "Legacy XML — works with BeerSmith and older imports.", fr: "XML hérité — compatible BeerSmith et anciens imports." },
  "recipe.export.html_label": { en: "Printable HTML / PDF", fr: "HTML / PDF imprimable" },
  "recipe.export.html_sub": { en: "Self-contained .html — open in any browser, print to PDF.", fr: ".html autonome — à ouvrir dans n'importe quel navigateur, imprimable en PDF." },

  // ─── Recipe — scale to rig button ────────────────────────────
  "recipe.scale.button": { en: "Adapt to my rig", fr: "Adapter à mon matériel" },
  "recipe.scale.noop_tooltip": { en: "Recipe already matches your rig — nothing to scale.", fr: "La recette correspond déjà à votre matériel — rien à mettre à l'échelle." },
  "recipe.scale.active_tooltip": { en: "Rescale to {name} ({batch} · {eff}% efficiency). Caps strike water to your mash tun if needed.", fr: "Mise à l'échelle vers {name} ({batch} · {eff} % d'efficacité). Plafonne l'eau d'empâtage selon votre cuve si besoin." },
  "recipe.scale.confirm": { en: "Adapt this recipe to \"{name}\"?\n\n{lines}\n\nIngredient amounts will be rescaled in place.", fr: "Adapter cette recette à « {name} » ?\n\n{lines}\n\nLes quantités d'ingrédients seront recalculées sur place." },
  "recipe.scale.line_batch": { en: "Batch: {from} → {to}", fr: "Volume : {from} → {to}" },
  "recipe.scale.line_efficiency": { en: "Efficiency: {from}% → {to}%", fr: "Efficacité : {from} % → {to} %" },
  "recipe.scale.line_capped": { en: "Strike water capped: {from} → {to} (won't fit {capacity} mash tun otherwise — sparge picks up the rest)", fr: "Eau d'empâtage plafonnée : {from} → {to} (sinon elle déborderait de votre cuve {capacity} — le rinçage compense)" },

  // ─── Recipe — BJCP style range badges ────────────────────────
  "recipe.style.in": { en: "Within style range", fr: "Dans la plage du style" },
  "recipe.style.near": { en: "Just outside style range", fr: "Juste hors plage du style" },
  "recipe.style.out": { en: "Outside style range", fr: "Hors plage du style" },

  // ─── Brew — step kinds (used in headers + step labels) ───────
  "brew.kind.prepare_water": { en: "Prepare water", fr: "Préparer l'eau" },
  "brew.kind.mash_in": { en: "Mash in", fr: "Empâtage" },
  "brew.kind.mash": { en: "Mash", fr: "Saccharification" },
  "brew.kind.sparge": { en: "Sparge", fr: "Rinçage" },
  "brew.kind.boil": { en: "Boil", fr: "Ébullition" },
  "brew.kind.hop_addition": { en: "Hop addition", fr: "Ajout de houblon" },
  "brew.kind.whirlpool": { en: "Whirlpool", fr: "Whirlpool" },
  "brew.kind.chill": { en: "Chill", fr: "Refroidissement" },
  "brew.kind.transfer": { en: "Transfer", fr: "Transvasement" },
  "brew.kind.ferment_pitch": { en: "Pitch", fr: "Ensemencement" },
  "brew.kind.custom": { en: "Step", fr: "Étape" },

  // ─── Brew — step stat-tile labels (per step kind) ───────────
  "brew.stat.target": { en: "Target", fr: "Cible" },
  "brew.stat.strike_volume": { en: "Strike volume", fr: "Volume d'empâtage" },
  "brew.stat.strike_water": { en: "Strike water", fr: "Eau d'empâtage" },
  "brew.stat.thickness": { en: "Thickness", fr: "Densité d'empâtage" },
  "brew.stat.total_grain": { en: "Total grain", fr: "Grain total" },
  "brew.stat.items": { en: "Items", fr: "Ingrédients" },
  "brew.stat.grain": { en: "Grain", fr: "Grain" },
  "brew.stat.sparge_water": { en: "Sparge water", fr: "Eau de rinçage" },
  "brew.stat.pre_boil_target": { en: "Pre-boil target", fr: "Cible avant ébullition" },
  "brew.stat.pre_boil": { en: "Pre-boil", fr: "Avant ébullition" },
  "brew.stat.absorbed": { en: "Absorbed", fr: "Absorbée" },
  "brew.stat.boil_off": { en: "Boil-off", fr: "Évaporation" },
  "brew.stat.hop_additions": { en: "Hop additions", fr: "Houblonnages" },
  "brew.stat.in_kettle": { en: "In kettle", fr: "Dans la cuve" },
  "brew.stat.to_fermenter": { en: "To fermenter", fr: "Vers le fermenteur" },
  "brew.stat.elapsed": { en: "elapsed", fr: "écoulé" },
  "brew.stat.overrun": { en: "overrun", fr: "dépassement" },

  // ─── Brew — hop schedule + lists ────────────────────────────
  "brew.hops.title": { en: "Hop schedule", fr: "Programme du houblonnage" },
  "brew.hops.mark_added": { en: "Mark added", fr: "Marquer ajouté" },
  "brew.hops.added": { en: "✓ added", fr: "✓ ajouté" },
  "brew.hops.tap_to_undo": { en: "Tap to undo", fr: "Toucher pour annuler" },
  "brew.hops.tap_when_added": { en: "Tap when added to the boil", fr: "Toucher après ajout à l'ébullition" },
  "brew.hops.at_min": { en: "@ {min} min", fr: "@ {min} min" },
  "brew.hops.in_duration": { en: "in {duration}", fr: "dans {duration}" },
  "brew.hops.next_label": { en: "Next addition", fr: "Prochain ajout" },
  "brew.hops.add_now": { en: "Add now", fr: "À ajouter maintenant" },
  "brew.grain_bill.title": { en: "Grain bill", fr: "Composition de la maische" },
  "brew.culture.title": { en: "Yeast pitch", fr: "Ensemencement" },
  "brew.culture.atten": { en: "{pct}% atten", fr: "{pct} % atténuation" },

  // ─── Brew — measurements form ───────────────────────────────
  "brew.meas.reading": { en: "Reading", fr: "Type de mesure" },
  "brew.meas.value": { en: "Value", fr: "Valeur" },
  "brew.meas.notes": { en: "Notes (optional)", fr: "Notes (facultatif)" },
  "brew.meas.notes_placeholder": { en: "pre-boil, post-chill, …", fr: "avant ébullition, après refroidissement, …" },
  "brew.meas.log": { en: "Log", fr: "Enregistrer" },
  "brew.meas.during": { en: "during {step}", fr: "pendant {step}" },
  "brew.meas.empty_disabled": { en: "No readings logged yet.", fr: "Aucune mesure enregistrée." },
  "brew.meas.empty_active": {
    en: "No readings logged yet. Use the form above to record gravities, pH, temperatures, or volumes as you brew.",
    fr: "Aucune mesure enregistrée. Utilisez le formulaire ci-dessus pour noter densités, pH, températures et volumes pendant le brassage.",
  },
  "brew.meas.kind.gravity_sg": { en: "Gravity", fr: "Densité" },
  "brew.meas.kind.temperature_c": { en: "Temperature", fr: "Température" },
  "brew.meas.kind.ph": { en: "pH", fr: "pH" },
  "brew.meas.kind.volume_l": { en: "Volume", fr: "Volume" },
  "brew.meas.kind.abv_pct": { en: "ABV", fr: "Alcool" },
  "brew.meas.delete": { en: "Delete reading", fr: "Supprimer la mesure" },
  "brew.step_notes_placeholder": { en: "Notes for this step…", fr: "Notes pour cette étape…" },

  // ─── Brew — fit-check banners ────────────────────────────────
  "brew.hlt.too_small": { en: "HLT too small", fr: "Cuve d'eau chaude trop petite" },
  "brew.hlt.overflow.strike": {
    en: "Strike water ({volume}) exceeds your HLT usable capacity ({capacity}). You can't heat this batch in one pass — split the heat or use a larger vessel.",
    fr: "L'eau d'empâtage ({volume}) dépasse la capacité utile de votre cuve d'eau chaude ({capacity}). Impossible de tout chauffer en une fois — fractionnez la chauffe ou utilisez une cuve plus grande.",
  },
  "brew.hlt.overflow.sparge": {
    en: "Sparge water ({volume}) exceeds your HLT usable capacity ({capacity}). You can't heat this batch in one pass — split the heat or use a larger vessel.",
    fr: "L'eau de rinçage ({volume}) dépasse la capacité utile de votre cuve d'eau chaude ({capacity}). Impossible de tout chauffer en une fois — fractionnez la chauffe ou utilisez une cuve plus grande.",
  },
  "brew.hlt.two_heats.title": { en: "Two-heat session", fr: "Chauffe en deux passes" },
  "brew.hlt.two_heats.body": {
    en: "Strike ({strike}) + sparge ({sparge}) = {total} exceeds your HLT capacity ({capacity}). Heat strike first, drain to mash, then heat sparge.",
    fr: "Empâtage ({strike}) + rinçage ({sparge}) = {total} dépasse votre cuve d'eau chaude ({capacity}). Chauffez l'empâtage d'abord, transférez vers la cuve d'empâtage, puis chauffez le rinçage.",
  },
  "brew.kettle.too_small": { en: "Kettle too small", fr: "Cuve d'ébullition trop petite" },
  "brew.kettle.overflow": {
    en: "Pre-boil volume ({preBoil}) exceeds your kettle usable capacity ({capacity}). You'll boil over — reduce batch size or use a bigger kettle.",
    fr: "Le volume avant ébullition ({preBoil}) dépasse la capacité utile de votre cuve d'ébullition ({capacity}). Ça va déborder — réduisez le brassin ou utilisez une plus grande cuve.",
  },

  // ─── Tasting form ────────────────────────────────────────────
  "tasting.axis.bitter": { en: "Bitter", fr: "Amer" },
  "tasting.axis.hop": { en: "Hop", fr: "Houblon" },
  "tasting.axis.sour": { en: "Sour", fr: "Acide" },
  "tasting.axis.carb": { en: "Carb", fr: "Pétillant" },
  "tasting.axis.body": { en: "Body", fr: "Corps" },
  "tasting.axis.malt": { en: "Malt", fr: "Malt" },
  "tasting.axis.sweet": { en: "Sweet", fr: "Doux" },
  "tasting.overall_rating": { en: "Overall rating", fr: "Note globale" },
  "tasting.tags": { en: "Tags", fr: "Étiquettes" },
  "tasting.tags_hint": {
    en: "(quick lessons surfaced on the recipe screen)",
    fr: "(observations rapides affichées sur l'écran recette)",
  },
  "tasting.tag_placeholder": { en: "Add a tag, press Enter…", fr: "Ajouter une étiquette, Entrée…" },
  "tasting.remove_tag": { en: "Remove tag", fr: "Retirer l'étiquette" },
  "tasting.notes": { en: "Notes", fr: "Notes" },
  "tasting.notes_placeholder": {
    en: "What worked, what to change next time…",
    fr: "Ce qui a marché, ce qu'il faudra changer la prochaine fois…",
  },
  "tasting.save": { en: "Save tasting", fr: "Enregistrer la dégustation" },
  "tasting.cancel": { en: "Cancel", fr: "Annuler" },
  "tasting.edit": { en: "Edit tasting", fr: "Modifier la dégustation" },
  "tasting.remove": { en: "Remove", fr: "Retirer" },
  "tasting.remove_confirm": {
    en: "Remove this tasting? The session keeps everything else.",
    fr: "Retirer cette dégustation ? La session conserve tout le reste.",
  },
  "tasting.suggest.best": { en: "best one yet", fr: "la meilleure jusqu'à présent" },
  "tasting.suggest.too_bitter": { en: "too bitter", fr: "trop amère" },
  "tasting.suggest.too_sweet": { en: "too sweet", fr: "trop sucrée" },
  "tasting.suggest.low_body": { en: "low body", fr: "corps léger" },
  "tasting.suggest.high_carb": { en: "high carb", fr: "très pétillante" },
  "tasting.summary.aria_rating": { en: "{n} of 5 stars", fr: "{n} étoiles sur 5" },

  // ─── Recipe screen — water chemistry ──────────────────────────
  "recipe.water.source_ppm": { en: "Source water (ppm)", fr: "Eau source (ppm)" },
  "recipe.water.source_profile": {
    en: "Source water profile",
    fr: "Profil d'eau source",
  },
  "recipe.water.source_custom": { en: "Custom", fr: "Personnalisé" },
  "recipe.water.save_default": { en: "Save as default", fr: "Enregistrer par défaut" },
  "recipe.water.saved_default": { en: "✓ saved as default", fr: "✓ enregistré par défaut" },
  "recipe.water.total": { en: "Total water", fr: "Eau totale" },
  "recipe.water.default_volume": { en: "Default {volume} L (mash + sparge)", fr: "Défaut {volume} L (empâtage + rinçage)" },
  "recipe.water.target_profile": { en: "Target profile", fr: "Profil cible" },
  "recipe.water.salts": { en: "Salt additions (g, total volume)", fr: "Ajouts de sels (g, volume total)" },
  "recipe.water.suggest": { en: "Suggest additions", fr: "Suggérer les ajouts" },
  "recipe.water.suggest_hint": {
    en: "Estimate the salts that move your source water toward the target profile.",
    fr: "Estime les sels qui rapprochent votre eau source du profil cible.",
  },
  "recipe.water.suggest_disabled": {
    en: "Pick a target profile first.",
    fr: "Choisissez d'abord un profil cible.",
  },
  "recipe.water.gypsum": { en: "Gypsum", fr: "Gypse" },
  "recipe.water.cacl2": { en: "CaCl₂", fr: "CaCl₂" },
  "recipe.water.epsom": { en: "Epsom", fr: "Sel d'Epsom" },
  "recipe.water.table_salt": { en: "Table salt", fr: "Sel de table" },
  "recipe.water.baking_soda": { en: "Baking soda", fr: "Bicarbonate de soude" },
  "recipe.water.so4_cl": { en: "SO₄ : Cl", fr: "SO₄ : Cl" },
  "recipe.water.flavor": { en: "Flavor lean", fr: "Tendance gustative" },
  "recipe.water.flavor.very_malty": { en: "Very malty", fr: "Très maltée" },
  "recipe.water.flavor.malty": { en: "Malty", fr: "Maltée" },
  "recipe.water.flavor.balanced": { en: "Balanced", fr: "Équilibrée" },
  "recipe.water.flavor.hoppy": { en: "Hoppy", fr: "Houblonnée" },
  "recipe.water.flavor.very_hoppy": { en: "Very hoppy", fr: "Très houblonnée" },
  "recipe.water.flavor.none": { en: "—", fr: "—" },
  "recipe.water.target": { en: "target {value}", fr: "cible {value}" },
  "recipe.water.subtitle": {
    en: "Source water + brewing-salt additions. Pick a target profile to see deltas on the resulting ion strip.",
    fr: "Eau source + ajouts de sels. Choisissez un profil cible pour voir les écarts sur la bande d'ions résultante.",
  },
  "recipe.water.section_title": { en: "Water chemistry", fr: "Chimie de l'eau" },
  "recipe.water.biab_hint": {
    en: "BIAB equipment — all water in the kettle at once, no sparge.",
    fr: "Équipement BIAB — toute l'eau dans la cuve d'ébullition en une fois, sans rinçage.",
  },
  "recipe.water.target.off": { en: "No target", fr: "Pas de cible" },
  "recipe.water.target.balanced": { en: "Balanced (general purpose)", fr: "Équilibrée (usage général)" },
  "recipe.water.target.pilsner": { en: "Pilsner / light lager", fr: "Pilsner / lager légère" },
  "recipe.water.target.pale_ale": { en: "Pale ale", fr: "Pale ale" },
  "recipe.water.target.american_ipa": { en: "American IPA (hop-forward)", fr: "IPA américaine (houblon dominant)" },
  "recipe.water.target.burton": { en: "Burton / English IPA", fr: "Burton / IPA anglaise" },
  "recipe.water.target.munich": { en: "Munich / amber lager", fr: "Munich / lager ambrée" },
  "recipe.water.target.dublin_stout": { en: "Dublin stout", fr: "Stout de Dublin" },
  "recipe.water.flavor_label.very_malty": { en: "Very malty", fr: "Très maltée" },
  "recipe.water.flavor_label.malty": { en: "Malty leaning", fr: "Tendance maltée" },
  "recipe.water.flavor_label.balanced": { en: "Balanced", fr: "Équilibrée" },
  "recipe.water.flavor_label.hoppy": { en: "Hop accent", fr: "Accent houblon" },
  "recipe.water.flavor_label.very_hoppy": { en: "Hop forward", fr: "Houblon dominant" },
  "recipe.water.flavor_label.none": { en: "—", fr: "—" },

  // ─── Recipe screen — carbonation ───────────────────────────────
  "recipe.carb.subtitle": {
    en: "Priming sugar amounts for bottle conditioning, plus the regulator pressure for force-carbonation in a keg.",
    fr: "Quantités de sucre d'amorçage pour le refermentation en bouteille, et la pression du détendeur pour la gazéification forcée en fût.",
  },
  "recipe.carb.target": { en: "Target", fr: "Cible" },
  "recipe.carb.target_hint": { en: "2.4 typical · 1.7 cask · 3.0 wheat", fr: "2,4 typique · 1,7 cask · 3,0 blanche" },
  "recipe.carb.package_temp": { en: "Package temp", fr: "Temp. d'embouteillage" },
  "recipe.carb.package_temp_hint": { en: "Highest fermentation temp", fr: "Température max de fermentation" },
  "recipe.carb.beer_volume": { en: "Beer volume", fr: "Volume de bière" },
  "recipe.carb.beer_volume_hint": { en: "Batch {volume} L", fr: "Brassin {volume} L" },
  "recipe.carb.serving_temp": { en: "Serving temp", fr: "Temp. de service" },
  "recipe.carb.serving_temp_hint": { en: "For force-carb pressure", fr: "Pour la pression de carbonatation" },
  "recipe.carb.residual": { en: "Residual at package", fr: "Résiduel à l'embouteillage" },
  "recipe.carb.residual_sub": { en: "Already dissolved at {temp}", fr: "Déjà dissous à {temp}" },
  "recipe.carb.to_add": { en: "Needs to add", fr: "À ajouter" },
  "recipe.carb.over_warn": { en: "Beer is already over the target — no priming", fr: "La bière dépasse déjà la cible — pas d'amorçage" },
  "recipe.carb.to_add_sub": { en: "Target − residual = {delta} vols", fr: "Cible − résiduel = {delta} vols" },
  "recipe.carb.priming": { en: "Priming sugar (bottle / keg conditioning)", fr: "Sucre d'amorçage (refermentation bouteille / fût)" },
  "recipe.carb.corn_sugar": { en: "Corn sugar", fr: "Dextrose" },
  "recipe.carb.corn_sugar_note": { en: "dextrose", fr: "dextrose" },
  "recipe.carb.sucrose": { en: "Table sugar", fr: "Sucre de table" },
  "recipe.carb.sucrose_note": { en: "sucrose", fr: "saccharose" },
  "recipe.carb.dme": { en: "DME", fr: "Extrait sec" },
  "recipe.carb.dme_note": { en: "dry malt extract", fr: "extrait de malt sec" },
  "recipe.carb.force": { en: "Force-carbonation pressure", fr: "Pression de gazéification forcée" },
  "recipe.carb.psi": { en: "PSI", fr: "PSI" },
  "recipe.carb.psi_sub": { en: "regulator at {temp}", fr: "détendeur à {temp}" },
  "recipe.carb.bar": { en: "Bar", fr: "Bar" },
  "recipe.carb.bar_sub": { en: "same pressure, metric", fr: "même pression, métrique" },

  // ─── Recipe screen — yeast pitch ──────────────────────────────
  "recipe.section.yeast": { en: "Yeast pitch", fr: "Ensemencement" },
  "recipe.yeast.cannot_compute": {
    en: "Can't compute pitch rate yet — the recipe is missing a grain bill or a batch size.",
    fr: "Calcul d'ensemencement impossible — la recette n'a pas encore de céréales ou de volume de brassée.",
  },
  "recipe.yeast.cannot_compute_missing": {
    en: "Can't compute pitch rate yet — add {items} to the recipe.",
    fr: "Calcul d'ensemencement impossible — ajoutez {items} à la recette.",
  },
  "recipe.yeast.missing.fermentables": { en: "fermentables", fr: "des fermentescibles" },
  "recipe.yeast.missing.batch_size": { en: "a batch size", fr: "un volume de brassée" },
  "recipe.yeast.subtitle": {
    en: "Target cell count for {form}. Adjust pack count and viability to match what you have on hand.",
    fr: "Compte de cellules cible pour {form}. Ajustez le nombre de sachets et la viabilité selon votre stock.",
  },
  "recipe.yeast.form.dry": { en: "dry yeast", fr: "levure sèche" },
  "recipe.yeast.form.liquid": { en: "liquid yeast", fr: "levure liquide" },
  "recipe.yeast.packs": { en: "Packs on hand", fr: "Sachets en stock" },
  "recipe.yeast.pack_unit.dry": { en: "sachets", fr: "sachets" },
  "recipe.yeast.pack_unit.liquid": { en: "packs", fr: "sachets" },
  "recipe.yeast.viability": { en: "Viability", fr: "Viabilité" },
  "recipe.yeast.viability_hint.dry": {
    en: "Dry yeast holds well — 97% fresh, drop to ~85% after a year",
    fr: "La levure sèche se conserve bien — 97 % frais, ~85 % après un an",
  },
  "recipe.yeast.viability_hint.liquid": {
    en: "Liquid yeast drops ~21%/month from production",
    fr: "La levure liquide perd ~21 %/mois depuis la production",
  },
  "recipe.yeast.packs_hint.dry": { en: "~11.5 g sachets, ~200 B cells fresh", fr: "~11,5 g/sachet, ~200 G cellules frais" },
  "recipe.yeast.packs_hint.liquid": { en: "Wyeast / White Labs smack-pack, ~100 B at production", fr: "Wyeast / White Labs smack-pack, ~100 G à la production" },
  "recipe.yeast.target": { en: "Target", fr: "Cible" },
  "recipe.yeast.target_sub": { en: "{rate} M/mL/°P at {og}", fr: "{rate} M/mL/°P à {og}" },
  "recipe.yeast.per_pack": { en: "Per pack (viable)", fr: "Par sachet (viable)" },
  "recipe.yeast.per_pack_sub": { en: "Pack × viability", fr: "Sachet × viabilité" },
  // SI giga (×10⁹) cell-count suffix. English "B" for billion;
  // French "Md" for milliards — "G" reads as grams in a brewing
  // context, and French "billion" actually means 10¹² so a literal
  // "B" would be wrong by three orders of magnitude.
  "recipe.yeast.billion_unit": { en: "B", fr: "Md" },
  "recipe.yeast.recommended": { en: "Recommended", fr: "Recommandé" },
  "recipe.yeast.exact_packs": { en: "{packs} packs exact", fr: "{packs} sachets exact" },
  "recipe.yeast.status": { en: "Status", fr: "État" },
  "recipe.yeast.sufficient": { en: "Sufficient", fr: "Suffisant" },
  "recipe.yeast.under_pitch": { en: "Under-pitch", fr: "Sous-ensemencement" },
  "recipe.yeast.shortfall": {
    en: "Short {cells} B — buy more or make a starter",
    fr: "Manque {cells} Md — achetez-en plus ou faites un pied de cuve",
  },
  "recipe.yeast.sufficient_body": {
    en: "{count} pack{s} covers the target",
    fr: "{count} sachet{s} couvre{s} la cible",
  },
  "recipe.yeast.starter_title": {
    en: "Suggested starter",
    fr: "Pied de cuve suggéré",
  },
  "recipe.yeast.starter_volume": { en: "Volume", fr: "Volume" },
  "recipe.yeast.starter_dme": { en: "DME", fr: "Extrait sec" },
  "recipe.yeast.starter_dme_sub": {
    en: "100 g/L · OG ≈ 1.036",
    fr: "100 g/L · OG ≈ 1,036",
  },
  "recipe.yeast.starter_predicted": { en: "Predicted", fr: "Prévu" },
  "recipe.yeast.starter_growth": {
    en: "{factor}× growth",
    fr: "croissance ×{factor}",
  },
  "recipe.yeast.starter_aeration": { en: "Aeration", fr: "Aération" },
  "recipe.yeast.starter_aeration_stir": { en: "Stir plate", fr: "Agitateur" },
  "recipe.yeast.starter_aeration_shake": {
    en: "Manual shake",
    fr: "Agitation manuelle",
  },
  "recipe.yeast.starter_aeration_none": { en: "Still", fr: "Sans agitation" },
  "recipe.yeast.starter_step_up": {
    en: "Single 4 L step falls short — consider a 2-step starter (pitch, decant, restart).",
    fr: "Une seule étape de 4 L ne suffit pas — envisagez un pied en 2 étapes (ensemencer, décanter, recommencer).",
  },

  // ─── Recipe screen — cost ─────────────────────────────────────
  "recipe.cost.note_default": {
    en: "Approximate. Adjust the global price coefficient in Settings to match your market.",
    fr: "Approximatif. Ajustez le coefficient global dans les Réglages pour coller à votre marché.",
  },
  "recipe.cost.note_inflated": {
    en: "Approximate · {pct}% of bundled prices (Settings → Cost adjustment).",
    fr: "Approximatif · {pct} % des prix de référence (Réglages → Ajustement des coûts).",
  },
  "recipe.cost.category.fermentable": { en: "Grain", fr: "Grain" },
  "recipe.cost.category.hop": { en: "Hop", fr: "Houblon" },
  "recipe.cost.category.culture": { en: "Yeast", fr: "Levure" },
  "recipe.cost.category.misc": { en: "Misc", fr: "Divers" },
  "recipe.cost.batch_total": { en: "Batch total", fr: "Total du brassin" },
  "recipe.cost.per_unit": { en: "Per {unit}", fr: "Par {unit}" },
  "recipe.cost.per_bottle": { en: "Per 330 mL bottle", fr: "Par bouteille 33 cL" },
  "recipe.cost.your_price": { en: "your price", fr: "votre prix" },
  "recipe.cost.your_price_hint": {
    en: "Using your personal price instead of the bundled estimate.",
    fr: "Utilise votre prix personnel plutôt que l'estimation par défaut.",
  },
  "recipe.cost.edit_price": { en: "Set your price", fr: "Définir votre prix" },
  "recipe.cost.reset_price": {
    en: "Reset to the bundled price",
    fr: "Revenir au prix par défaut",
  },

  // ─── Equipment screen ────────────────────────────────────────
  "equipment.title": { en: "Equipment", fr: "Matériel" },
  "equipment.default_profile_name": { en: "Profile {n}", fr: "Profil {n}" },
  "equipment.subtitle_loading": { en: "Werb · loading…", fr: "Werb · chargement…" },
  "equipment.subtitle_count": { en: "Werb · {count} profile{s}", fr: "Werb · {count} profil{s}" },
  "equipment.intro": {
    en: "Define your kettle, mash tun, fermenter and losses. The active profile drives water volume calculations across the library, recipe view and brew mode.",
    fr: "Définissez votre cuve d'ébullition, cuve d'empâtage, fermenteur et pertes. Le profil actif pilote les calculs d'eau dans la bibliothèque, la recette et le brassage.",
  },
  "equipment.empty.heading": { en: "No equipment profile yet.", fr: "Aucun profil de matériel pour le moment." },
  "equipment.empty.body": {
    en: "Without a profile, the calc engine uses generic defaults (75% efficiency, 3 L/h evap, 0 dead space). Define yours to get accurate water volumes for every recipe.",
    fr: "Sans profil, le moteur utilise des valeurs génériques (75 % efficacité, 3 L/h évap., 0 volume mort). Définissez le vôtre pour obtenir des volumes d'eau précis sur chaque recette.",
  },
  "equipment.empty.create": { en: "Create your first profile", fr: "Créer votre premier profil" },
  "equipment.new_profile": { en: "+ New profile", fr: "+ Nouveau profil" },
  "equipment.active_badge": { en: "active", fr: "actif" },
  "equipment.select_profile": { en: "Select a profile.", fr: "Sélectionnez un profil." },

  "equipment.field.name": { en: "Name", fr: "Nom" },
  "equipment.field.description": { en: "Description", fr: "Description" },
  "equipment.field.batch_size": { en: "Batch size", fr: "Volume du brassin" },
  "equipment.field.efficiency": { en: "Brewhouse efficiency", fr: "Efficacité de brasserie" },
  "equipment.section.hlt": { en: "Hot liquor tank", fr: "Cuve d'eau chaude" },
  "equipment.section.mash_tun": { en: "Mash tun", fr: "Cuve d'empâtage" },
  "equipment.section.kettle": { en: "Kettle", fr: "Cuve d'ébullition" },
  "equipment.section.fermenter": { en: "Fermenter", fr: "Fermenteur" },
  "equipment.field.capacity": { en: "Capacity", fr: "Capacité" },
  "equipment.field.dead_space": { en: "Dead space", fr: "Volume mort" },
  "equipment.field.grain_absorption": { en: "Grain absorption", fr: "Absorption du grain" },
  "equipment.field.mash_thickness": { en: "Mash thickness", fr: "Épaisseur d'empâtage" },
  "equipment.field.boil_off": { en: "Boil-off rate", fr: "Taux d'évaporation" },
  "equipment.field.post_boil_shrink": { en: "Post-boil shrink", fr: "Retrait après ébullition" },
  "equipment.field.trub_loss": { en: "Trub loss", fr: "Perte au trub" },
  "equipment.field.transfer_loss": { en: "Kettle → fermenter transfer loss", fr: "Perte au transfert cuve → fermenteur" },
  "equipment.field.mash_mode": { en: "Mash mode", fr: "Mode d'empâtage" },
  "equipment.field.mash_mode_hint": {
    en: "Classic = mash tun + separate sparge. BIAB = grain bag in the kettle, full water at once, no sparge.",
    fr: "Classique = cuve d'empâtage + rinçage séparé. BIAB = sac de grain dans la cuve d'ébullition, toute l'eau en une fois, sans rinçage.",
  },
  "equipment.opt.mash_classic": { en: "Classic 3-vessel", fr: "Classique 3 cuves" },
  "equipment.opt.mash_biab": { en: "BIAB (brew in a bag)", fr: "BIAB (sac dans la cuve)" },
  "equipment.field.notes": { en: "Notes", fr: "Notes" },

  "equipment.set_active": { en: "Set as active", fr: "Définir comme actif" },
  "equipment.active_clear": { en: "✓ Active — clear", fr: "✓ Actif — désactiver" },
  "equipment.delete_profile": { en: "Delete profile", fr: "Supprimer le profil" },
  "equipment.delete_confirm": { en: "Delete \"{name}\"?", fr: "Supprimer « {name} » ?" },

  "equipment.wizard.title": { en: "Quick start", fr: "Démarrage rapide" },
  "equipment.wizard.subtitle": {
    en: "Size every field from a target batch + setup type",
    fr: "Dimensionnez chaque champ à partir d'un volume cible + type de configuration",
  },
  "equipment.wizard.setup_type": { en: "Setup type", fr: "Type de configuration" },
  "equipment.wizard.three_vessel": { en: "3-vessel", fr: "3 cuves" },
  "equipment.wizard.two_vessel": { en: "2-vessel", fr: "2 cuves" },
  "equipment.wizard.biab": { en: "BIAB", fr: "BIAB" },
  "equipment.wizard.three_vessel_hint": { en: "HLT + mash tun + kettle (HERMS / RIMS)", fr: "Cuve eau chaude + empâtage + ébullition (HERMS / RIMS)" },
  "equipment.wizard.two_vessel_hint": { en: "Mash tun + kettle (kettle doubles as HLT)", fr: "Empâtage + ébullition (l'ébullition sert aussi à chauffer l'eau)" },
  "equipment.wizard.biab_hint": { en: "Single kettle — full-volume mash, no sparge", fr: "Une seule cuve — empâtage pleine eau, sans rinçage" },
  "equipment.wizard.target_batch": { en: "Target batch", fr: "Volume cible" },
  "equipment.wizard.apply": { en: "Apply", fr: "Appliquer" },
  "equipment.wizard.replaces_note": {
    en: "Replaces all capacity, dead-space, and rate fields below. Name, description, and notes are kept.",
    fr: "Remplace tous les champs de capacité, volume mort et taux ci-dessous. Nom, description et notes sont conservés.",
  },
  "equipment.wizard.preview.line1": {
    en: "~{grain} kg grain · {mash} L mash{spargePart} · pre-boil {preBoil} L",
    fr: "~{grain} kg de grain · {mash} L d'empâtage{spargePart} · avant ébullition {preBoil} L",
  },
  "equipment.wizard.preview.sparge": {
    en: " + {sparge} L sparge",
    fr: " + {sparge} L de rinçage",
  },

  // ─── Error boundary ────────────────────────────────────────────
  "error.heading": { en: "Werb hit an unexpected error", fr: "Werb a rencontré une erreur inattendue" },
  "error.tag": { en: "Something went wrong", fr: "Une erreur s'est produite" },
  "error.body": {
    en: "Your data is safe — nothing is saved automatically when a render fails. Try again, or reload if it persists.",
    fr: "Vos données sont en sécurité — rien n'est enregistré automatiquement lors d'une erreur d'affichage. Réessayez, ou rechargez si le problème persiste.",
  },
  "error.file_issue": {
    en: "If this keeps happening, file an issue and include the message above.",
    fr: "Si le problème persiste, ouvrez une issue en incluant le message ci-dessus.",
  },

  // ─── Recipe editor ────────────────────────────────────────────
  "editor.title": { en: "Edit recipe", fr: "Modifier la recette" },
  "editor.intro": {
    en: "Changes are kept locally until you press Save changes.",
    fr: "Les modifications sont gardées localement jusqu'à ce que vous appuyiez sur Enregistrer.",
  },
  "editor.cancel": { en: "Cancel", fr: "Annuler" },
  "editor.save": { en: "Save changes", fr: "Enregistrer" },
  "editor.unsaved.confirm": {
    en: "You have unsaved changes. Discard them?",
    fr: "Des modifications ne sont pas enregistrées. Les abandonner ?",
  },
  "editor.stepper.increment": { en: "Increase", fr: "Augmenter" },
  "editor.stepper.decrement": { en: "Decrease", fr: "Diminuer" },
  "editor.tools.label": { en: "Retarget", fr: "Recibler" },
  "editor.tools.scale": { en: "Scale to…", fr: "Mettre à l'échelle…" },
  "editor.tools.solve_og": { en: "Solve to OG…", fr: "Viser une DI…" },
  "editor.tools.solve_ibu": { en: "Solve to IBU…", fr: "Viser des IBU…" },
  "editor.tools.apply": { en: "Apply", fr: "Appliquer" },
  "editor.tools.cancel": { en: "Cancel", fr: "Annuler" },
  "editor.section.recipe": { en: "Recipe", fr: "Recette" },
  "editor.section.fermentables": { en: "Fermentables", fr: "Fermentescibles" },
  "editor.section.hops": { en: "Hops", fr: "Houblons" },
  "editor.section.cultures": { en: "Cultures", fr: "Levures" },
  "editor.section.mash": { en: "Mash schedule", fr: "Schéma d'empâtage" },
  "editor.section.miscs": { en: "Miscellaneous", fr: "Divers" },
  "editor.field.name": { en: "Name", fr: "Nom" },
  "editor.field.type": { en: "Type", fr: "Type" },
  "editor.field.author": { en: "Author", fr: "Auteur" },
  "editor.field.batch_size": { en: "Batch size", fr: "Volume" },
  "editor.field.brewhouse_eff": { en: "Brewhouse efficiency", fr: "Efficacité de brassage" },
  "editor.field.notes": { en: "Notes", fr: "Notes" },
  "editor.field.style": { en: "Style", fr: "Style" },
  "editor.col.name": { en: "Name", fr: "Nom" },
  "editor.col.type": { en: "Type", fr: "Type" },
  "editor.col.amount": { en: "Amount", fr: "Quantité" },
  "editor.col.color": { en: "Color", fr: "Couleur" },
  "editor.col.yield": { en: "Yield", fr: "Rdt" },
  "editor.col.use": { en: "Use", fr: "Usage" },
  "editor.col.time": { en: "Time", fr: "Temps" },
  "editor.col.alpha": { en: "Alpha", fr: "Alpha" },
  "editor.col.form": { en: "Form", fr: "Forme" },
  "editor.col.attenuation": { en: "Attenuation", fr: "Atténuation" },
  "editor.col.temp": { en: "Temp", fr: "Temp." },
  "editor.col.infusion": { en: "Infusion", fr: "Infusion" },
  "editor.add.fermentable": { en: "+ Add fermentable", fr: "+ Ajouter un fermentescible" },
  "editor.add.hop": { en: "+ Add hop", fr: "+ Ajouter un houblon" },
  "editor.add.culture": { en: "+ Add culture", fr: "+ Ajouter une levure" },
  "editor.add.mash_step": { en: "+ Add mash step", fr: "+ Ajouter une étape d'empâtage" },
  "editor.add.misc": { en: "+ Add miscellaneous", fr: "+ Ajouter un ingrédient divers" },
  "editor.placeholder.pick_fermentable": {
    en: "Pick a fermentable…",
    fr: "Choisir un fermentescible…",
  },
  "editor.placeholder.pick_hop": { en: "Pick a hop…", fr: "Choisir un houblon…" },
  "editor.placeholder.pick_culture": {
    en: "Pick a culture…",
    fr: "Choisir une levure…",
  },
  "editor.placeholder.pick_misc": {
    en: "Pick an addition…",
    fr: "Choisir un ingrédient…",
  },
  "editor.row.delete": { en: "Delete", fr: "Supprimer" },
  "editor.mash.empty": { en: "No mash steps. Add one below.", fr: "Aucune étape d'empâtage. Ajoutez-en une ci-dessous." },
  "editor.style.clear_title": { en: "Clear style", fr: "Effacer le style" },
  "editor.style.clear": { en: "Clear", fr: "Effacer" },
  "editor.hop.use.boil": { en: "Boil", fr: "Ébullition" },
  "editor.hop.use.whirlpool": { en: "Whirlpool / Hopstand", fr: "Whirlpool / Hopstand" },
  "editor.hop.use.dry_hop": { en: "Dry hop", fr: "Dry-hop" },
  "editor.hop.use.mash": { en: "Mash", fr: "Empâtage" },
  "editor.hop.use.package": { en: "Package", fr: "Conditionnement" },
  "editor.misc.use.boil": { en: "Boil", fr: "Ébullition" },
  "editor.misc.use.mash": { en: "Mash", fr: "Empâtage" },
  "editor.misc.use.ferment": { en: "Ferment", fr: "Fermentation" },
  "editor.misc.use.package": { en: "Package", fr: "Conditionnement" },

  // ─── Structured errors (WerbError codes) ─────────────────────
  // Import (BeerJSON / BeerXML)
  "error.import.invalid_json": { en: "Invalid JSON: {detail}", fr: "JSON invalide : {detail}" },
  "error.import.not_beerjson": { en: "Not valid BeerJSON 2.x — {detail}", fr: "BeerJSON 2.x invalide — {detail}" },
  "error.import.no_recipes_beerjson": {
    en: "File is valid BeerJSON but contains no recipes.",
    fr: "Le fichier est un BeerJSON valide, mais ne contient aucune recette.",
  },
  "error.import.no_recipes_beerxml": {
    en: "File parsed but contained no recipes.",
    fr: "Le fichier a été analysé mais ne contient aucune recette.",
  },
  "error.import.beerxml_parse_failed": { en: "BeerXML parse failed: {detail}", fr: "Échec de l'analyse BeerXML : {detail}" },
  "error.import.read_failed": { en: "Read failed: {detail}", fr: "Échec de lecture : {detail}" },
  "error.import.no_samples": { en: "No bundled samples found.", fr: "Aucun exemple intégré trouvé." },
  "library.import.skipped": {
    en: "Skipped {count} duplicate{s} already in your library: {names}. Use the \"+\" on a card to make an intentional copy.",
    fr: "{count} doublon{s} ignoré{s} déjà dans votre bibliothèque : {names}. Utilisez le « + » sur une carte pour faire une copie intentionnelle.",
  },

  // Export (download / write)
  "error.export.download_failed": { en: "Download failed: {detail}", fr: "Échec du téléchargement : {detail}" },
  "error.export.write_failed": { en: "Write failed: {detail}", fr: "Échec d'écriture : {detail}" },

  // GitHub sync
  "error.github.invalid_token": {
    en: "Invalid token. Check that it hasn't expired or been revoked.",
    fr: "Token invalide. Vérifiez qu'il n'a pas expiré ou été révoqué.",
  },
  "error.github.unreachable_api": {
    en: "Couldn't reach GitHub ({status}). Check your network.",
    fr: "Impossible de joindre GitHub ({status}). Vérifiez votre réseau.",
  },
  "error.github.repo_not_found": {
    en: "Repo \"{repo}\" not found, or the token doesn't have access. For fine-grained tokens, make sure Contents: read+write is enabled.",
    fr: "Dépôt « {repo} » introuvable, ou le token n'y a pas accès. Pour les tokens fine-grained, vérifiez que Contents : read+write est activé.",
  },
  "error.github.unreachable_repo": {
    en: "Couldn't reach the repo ({status}).",
    fr: "Impossible de joindre le dépôt ({status}).",
  },
  "error.github.no_write_access": {
    en: "The token has read but not write access to \"{repo}\".",
    fr: "Le token a un accès en lecture mais pas en écriture sur « {repo} ».",
  },
  "error.github.read_failed": { en: "GitHub read failed ({status}): {detail}", fr: "Échec de lecture GitHub ({status}) : {detail}" },
  "error.github.write_failed": { en: "GitHub write failed ({status}): {detail}", fr: "Échec d'écriture GitHub ({status}) : {detail}" },
  "error.github.delete_failed": { en: "GitHub delete failed ({status}): {detail}", fr: "Échec de suppression GitHub ({status}) : {detail}" },
  "error.github.list_failed": { en: "GitHub list failed ({status}): {detail}", fr: "Échec de listage GitHub ({status}) : {detail}" },
};

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const entry = STRINGS[key];
  if (!entry) {
    if (typeof console !== "undefined") {
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }
  // English is the canonical fallback when a key isn't translated yet
  // for the active locale. New keys can ship en-only and the FR side
  // can catch up without breaking the UI.
  let out = entry[locale] || entry.en;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(String(v));
    }
    // Convenience: `{s}` plural helper. If a `count` var is set, it
    // resolves to "" for count==1, "s" otherwise — French and English
    // both pluralize with an s in the common cases this app hits
    // ("1 recipe" / "2 recipes", "1 recette" / "2 recettes").
    if ("count" in vars) {
      const c = Number(vars.count);
      out = out.split("{s}").join(c === 1 ? "" : "s");
    }
  }
  return out;
}
