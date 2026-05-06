/// Tauri command: parse a BeerXML 1.0 document and return each recipe as
/// a BeerJSON 2.x JSON value. The frontend can then push these straight
/// into the recipe store, exactly as if they had come from an imported
/// .beerjson file.
#[tauri::command]
fn parse_beerxml(xml: String) -> Result<Vec<serde_json::Value>, String> {
    werb_beerxml::parse(&xml)
        .map(|recipes| recipes.iter().map(|r| r.to_beerjson()).collect())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![parse_beerxml])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
