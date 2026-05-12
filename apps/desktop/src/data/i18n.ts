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

  // ─── Navigation (DevNav) ──────────────────────────────────────
  "nav.library": { en: "Library", fr: "Bibliothèque" },
  "nav.journal": { en: "Journal", fr: "Journal" },
  "nav.equipment": { en: "Equipment", fr: "Matériel" },
  "nav.settings": { en: "Settings", fr: "Réglages" },
  "nav.tokens": { en: "Tokens", fr: "Tokens" },

  // ─── Library ───────────────────────────────────────────────────
  "library.title": { en: "Library", fr: "Bibliothèque" },
  "library.subtitle_loading": { en: "Werb · loading…", fr: "Werb · chargement…" },
  "library.subtitle_count": { en: "Werb · {count} recipe{s}", fr: "Werb · {count} recette{s}" },
  "library.new_recipe": { en: "+ New recipe", fr: "+ Nouvelle recette" },
  "library.import_beerjson": { en: "Import .beerjson", fr: "Importer .beerjson" },
  "library.import_beerxml": { en: "Import .beerxml", fr: "Importer .beerxml" },
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

  // ─── Brew ──────────────────────────────────────────────────────
  "brew.session_label": { en: "Brew session · {status}", fr: "Session de brassage · {status}" },
  "brew.started_at": { en: "Started {time}", fr: "Démarré le {time}" },
  "brew.status.draft": { en: "Draft", fr: "Brouillon" },
  "brew.status.in_progress": { en: "In progress", fr: "En cours" },
  "brew.status.completed": { en: "Completed", fr: "Terminé" },
  "brew.status.abandoned": { en: "Abandoned", fr: "Abandonné" },
  "brew.wake": { en: "WAKE", fr: "ACTIF" },
  "brew.sleep": { en: "SLEEP", fr: "VEILLE" },
  "brew.timeline": { en: "Timeline", fr: "Chronologie" },
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
  "recipe.start_brewing": { en: "Start brewing →", fr: "Démarrer le brassage →" },
  "recipe.resume_brewing": { en: "Resume brewing →", fr: "Reprendre le brassage →" },
  "recipe.edit": { en: "Edit recipe", fr: "Modifier la recette" },
  "recipe.section.water": { en: "Water volumes", fr: "Volumes d'eau" },
  "recipe.section.fermentables": { en: "Fermentables", fr: "Fermentescibles" },
  "recipe.section.hops": { en: "Hop additions", fr: "Houblonnage" },
  "recipe.section.miscs": { en: "Miscellaneous", fr: "Divers" },
  "recipe.section.mash": { en: "Mash schedule", fr: "Programme d'empâtage" },
  "recipe.section.cultures": { en: "Cultures", fr: "Levures" },
  "recipe.section.cost": { en: "Cost", fr: "Coût" },
  "recipe.section.tasting": { en: "Last tasting", fr: "Dernière dégustation" },
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

  // ─── Settings ─────────────────────────────────────────────────
  "settings.title": { en: "Sync & storage", fr: "Synchronisation et stockage" },
  "settings.subtitle": { en: "Werb · settings", fr: "Werb · réglages" },
  "settings.intro": {
    en: "Keep recipes, equipment profiles, and brew sessions in sync across devices via a private GitHub repo. Manual push / pull in v1 — no background sync.",
    fr: "Gardez recettes, profils de matériel et sessions de brassage synchronisés entre appareils via un dépôt GitHub privé. Push / pull manuel en v1 — pas de synchronisation en arrière-plan.",
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
  "settings.units.currency": { en: "Currency", fr: "Devise" },
  "settings.units.cost_adjustment": { en: "Cost adjustment", fr: "Ajustement des coûts" },
  "settings.units.cost_adjustment_hint": {
    en: "Scales the bundled ingredient prices used on the recipe Cost section. 100% = the EUR baseline. Bump to 110-130 if your local supplier is pricier; dial down for bulk / co-op pricing.",
    fr: "Ajuste les prix d'ingrédients groupés utilisés dans la section Coût. 100 % = référence EUR. Montez à 110-130 si votre fournisseur est plus cher localement, baissez pour des prix en gros / coopérative.",
  },
  "settings.units.language": { en: "Language", fr: "Langue" },
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
