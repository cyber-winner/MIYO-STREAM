// TETO desktop shell.
//
// The app UI is served from a real local HTTP server (http://localhost:<port>)
// instead of Tauri's default custom protocol (tauri://). This gives the
// desktop app the exact same origin model as the Android (Capacitor) app,
// which serves from https://localhost — so YouTube embeds, provider iframes,
// referer checks, and web APIs all behave identically to the mobile app.
// Everything remains 100% local: the server only serves the bundled assets.
// The IPC permission grant for the localhost origin lives in
// capabilities/default.json (the `remote` block).

#[cfg(not(dev))]
use tauri::Url;
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port: u16 = portpicker::pick_unused_port().expect("no free port available");

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_localhost::Builder::new(port).build())
        .setup(move |app| {
            // Dev mode: use the Vite dev server as usual.
            #[cfg(dev)]
            let url = WebviewUrl::default();

            // Production: point the window at the local HTTP server.
            #[cfg(not(dev))]
            let url = {
                let url: Url = format!("http://localhost:{}", port).parse().unwrap();
                WebviewUrl::External(url)
            };

            WebviewWindowBuilder::new(app, "main", url)
                .title("TETO")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .resizable(true)
                .background_color(tauri::webview::Color(10, 10, 10, 255))
                // Only reject non-web schemes (things that could launch
                // external applications). Host-based blocking is impossible
                // here: on Linux this fires for iframe navigations too and
                // would break the players. Ad popup WINDOWS are blocked
                // because no new-window handler exists in this webview.
                .on_navigation(|url| {
                    matches!(
                        url.scheme(),
                        "tauri" | "http" | "https" | "blob" | "data" | "asset" | "about"
                    )
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TETO");
}
