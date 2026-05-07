// BeerXML parsing is now done in the frontend via werb-beerxml-wasm —
// the same code path runs in the browser build, so we no longer need a
// dedicated Tauri command for it. Kept the file as the entry point in
// case future native commands land here (file watchers, OS-level brew
// timers, …).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
