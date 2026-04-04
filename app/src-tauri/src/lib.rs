use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    Runtime, WebviewBuilder, WebviewUrl, WebviewWindow,
};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};
use tauri_plugin_store::{Store, StoreBuilder};
use url::Url;

const STORE_NAME: &str = "qi-data.json";
pub const MAX_WEBSITES: usize = 9;
const TAB_BAR_HEIGHT: f64 = 41.0;

// --- Data Types ---

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct WindowSizes {
    pub left_width_percent: u32,
    pub right_width_percent: u32,
    pub top_height_percent: u32,
    pub bottom_height_percent: u32,
}

impl Default for WindowSizes {
    fn default() -> Self {
        Self {
            left_width_percent: 60,
            right_width_percent: 60,
            top_height_percent: 60,
            bottom_height_percent: 60,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Website {
    pub name: String,
    pub url: String,
    pub logo: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct StoreData {
    pub websites: Vec<Website>,
    pub window_sizes: WindowSizes,
    pub scratch_text: String,
}

impl Default for StoreData {
    fn default() -> Self {
        Self {
            websites: Vec::new(),
            window_sizes: WindowSizes::default(),
            scratch_text: String::new(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct WebsiteInput {
    pub url: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub logo: Option<String>,
}

// --- Store Operations ---

pub fn build_store<R: Runtime>(app: &AppHandle<R>) -> Result<Arc<Store<R>>, String> {
    StoreBuilder::new(app, STORE_NAME)
        .build()
        .map_err(|e| format!("Failed to open store: {e}"))
}

fn read_store_data<R: Runtime>(store: &Store<R>) -> StoreData {
    let websites = store
        .get("websites")
        .and_then(|v| serde_json::from_value::<Vec<Website>>(v).ok())
        .unwrap_or_default();
    let window_sizes = store
        .get("windowSizes")
        .and_then(|v| serde_json::from_value::<WindowSizes>(v).ok())
        .unwrap_or_default();
    let scratch_text = store
        .get("scratchText")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();

    StoreData {
        websites,
        window_sizes,
        scratch_text,
    }
}

fn write_store_data<R: Runtime>(store: &Store<R>, data: &StoreData) -> Result<(), String> {
    store.set(
        "websites",
        Value::from(serde_json::to_value(&data.websites).unwrap()),
    );
    store.set(
        "windowSizes",
        Value::from(serde_json::to_value(&data.window_sizes).unwrap()),
    );
    store.set("scratchText", Value::String(data.scratch_text.clone()));
    store
        .save()
        .map_err(|e| format!("Failed saving store: {e}"))
}

fn normalize_website(input: WebsiteInput) -> Result<Website, String> {
    let parsed = Url::parse(&input.url).map_err(|e| format!("Invalid URL: {e}"))?;
    let name = input
        .name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| parsed.host_str().unwrap_or("Site").replace("www.", ""));
    let color = input
        .color
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "#4285F4".to_string());
    let logo = input
        .logo
        .unwrap_or_else(|| format!("{}favicon.ico", parsed.origin().ascii_serialization()));
    Ok(Website {
        name,
        url: parsed.into(),
        logo,
        color,
    })
}

fn validate_websites(websites: &[Website]) -> Result<(), String> {
    if websites.len() > MAX_WEBSITES {
        return Err(format!("Maximum of {MAX_WEBSITES} websites allowed"));
    }
    let mut seen = std::collections::HashSet::new();
    for w in websites {
        if Url::parse(&w.url).is_err() {
            return Err(format!("Invalid URL in list: {}", w.url));
        }
        if !seen.insert(&w.url) {
            return Err("Duplicate URLs are not allowed".into());
        }
    }
    Ok(())
}

pub fn get_data<R: Runtime>(app: &AppHandle<R>) -> Result<StoreData, String> {
    let store = build_store(app)?;
    Ok(read_store_data(&store))
}

pub fn save_websites<R: Runtime>(
    app: &AppHandle<R>,
    websites: Vec<Website>,
) -> Result<Vec<Website>, String> {
    validate_websites(&websites)?;
    let store = build_store(app)?;
    let mut data = read_store_data(&store);
    data.websites = websites.clone();
    write_store_data(&store, &data)?;
    Ok(websites)
}

pub fn add_website<R: Runtime>(
    app: &AppHandle<R>,
    input: WebsiteInput,
) -> Result<Vec<Website>, String> {
    let store = build_store(app)?;
    let mut data = read_store_data(&store);
    let website = normalize_website(input)?;
    if data.websites.iter().any(|w| w.url == website.url) {
        return Err("URL already exists in your list".into());
    }
    data.websites.push(website);
    validate_websites(&data.websites)?;
    write_store_data(&store, &data)?;
    Ok(data.websites)
}

pub fn remove_website<R: Runtime>(
    app: &AppHandle<R>,
    index: usize,
) -> Result<Vec<Website>, String> {
    let store = build_store(app)?;
    let mut data = read_store_data(&store);
    if index < data.websites.len() {
        data.websites.remove(index);
        write_store_data(&store, &data)?;
    }
    Ok(data.websites)
}

pub fn reorder_websites<R: Runtime>(
    app: &AppHandle<R>,
    websites: Vec<Website>,
) -> Result<Vec<Website>, String> {
    save_websites(app, websites)
}

pub fn get_window_sizes<R: Runtime>(app: &AppHandle<R>) -> Result<WindowSizes, String> {
    let store = build_store(app)?;
    Ok(read_store_data(&store).window_sizes)
}

pub fn save_window_sizes<R: Runtime>(
    app: &AppHandle<R>,
    sizes: WindowSizes,
) -> Result<WindowSizes, String> {
    let store = build_store(app)?;
    let mut data = read_store_data(&store);
    data.window_sizes = sizes.clone();
    write_store_data(&store, &data)?;
    Ok(sizes)
}

pub fn get_scratch_text<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let store = build_store(app)?;
    Ok(read_store_data(&store).scratch_text)
}

pub fn set_scratch_text<R: Runtime>(app: &AppHandle<R>, text: String) -> Result<String, String> {
    let store = build_store(app)?;
    let mut data = read_store_data(&store);
    data.scratch_text = text.clone();
    write_store_data(&store, &data)?;
    Ok(text)
}

// --- Window Management ---

pub fn show_all_windows<R: Runtime>(app: &AppHandle<R>) {
    for window in app.webview_windows().values() {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn hide_all_windows<R: Runtime>(app: &AppHandle<R>) {
    for window in app.webview_windows().values() {
        let _ = window.hide();
    }
}

pub fn find_active_window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app.webview_windows()
        .values()
        .find(|w| w.is_focused().unwrap_or(false))
        .cloned()
        .or_else(|| app.get_webview_window("main"))
}

// --- Window Position ---

#[derive(Clone, Copy)]
enum WindowPosition {
    Left,
    Right,
    Top,
    Bottom,
}

async fn resize_active_window(app: &AppHandle, position: WindowPosition) -> Result<(), String> {
    let window_sizes = get_window_sizes(app)?;
    let Some(win) = find_active_window(app) else {
        return Ok(());
    };
    let Some(monitor) = win.current_monitor().map_err(|e| e.to_string())? else {
        return Ok(());
    };
    let size = monitor.size();
    let origin = monitor.position();

    let (width, height, x, y) = match position {
        WindowPosition::Left => (
            (size.width as f64 * (window_sizes.left_width_percent as f64 / 100.0)) as u32,
            size.height,
            origin.x,
            origin.y,
        ),
        WindowPosition::Right => {
            let width =
                (size.width as f64 * (window_sizes.right_width_percent as f64 / 100.0)) as u32;
            (
                width,
                size.height,
                origin.x + (size.width as i32 - width as i32),
                origin.y,
            )
        }
        WindowPosition::Top => (
            size.width,
            (size.height as f64 * (window_sizes.top_height_percent as f64 / 100.0)) as u32,
            origin.x,
            origin.y,
        ),
        WindowPosition::Bottom => {
            let height =
                (size.height as f64 * (window_sizes.bottom_height_percent as f64 / 100.0)) as u32;
            (
                size.width,
                height,
                origin.x,
                origin.y + (size.height as i32 - height as i32),
            )
        }
    };

    win.set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    win.set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn toggle_visibility(app: &AppHandle) {
    let any_visible = app
        .webview_windows()
        .values()
        .any(|w| w.is_visible().unwrap_or(false));
    if any_visible {
        hide_all_windows(app);
    } else {
        show_all_windows(app);
    }
}

fn cycle_windows(app: &AppHandle, forward: bool) {
    let mut windows: Vec<_> = app.webview_windows().values().cloned().collect();
    if windows.len() <= 1 {
        return;
    }
    windows.sort_by_key(|w| w.label().to_string());
    let active_label = find_active_window(app).map(|w| w.label().to_string());
    let current_idx =
        active_label.and_then(|label| windows.iter().position(|w| w.label() == label));
    let next_idx = match (current_idx, forward) {
        (Some(idx), true) => (idx + 1) % windows.len(),
        (Some(idx), false) => (idx + windows.len() - 1) % windows.len(),
        (None, _) => 0,
    };
    if let Some(next) = windows.get(next_idx) {
        let _ = next.show();
        let _ = next.set_focus();
    }
}

fn hide_site_webviews(app: &AppHandle, except: Option<&str>) {
    for i in 0..MAX_WEBSITES {
        let label = format!("site-{i}");
        if except == Some(label.as_str()) {
            continue;
        }
        if let Some(webview) = app.get_webview(&label) {
            let _ = webview.hide();
        }
    }
}

fn refit_site_webviews(app: &AppHandle) {
    let Some(window) = app.get_window("main") else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };
    let Ok(scale) = window.scale_factor() else {
        return;
    };
    let lw = size.width as f64 / scale;
    let lh = size.height as f64 / scale;

    for i in 0..MAX_WEBSITES {
        let label = format!("site-{i}");
        if let Some(webview) = app.get_webview(&label) {
            // Refit all existing site webviews (visible ones are on-screen)
            let _ = webview.set_position(LogicalPosition::new(0.0, TAB_BAR_HEIGHT));
            let _ = webview.set_size(LogicalSize::new(lw, lh - TAB_BAR_HEIGHT));
        }
    }
}

async fn open_site_in_window(app: &AppHandle, index: usize) -> Result<(), String> {
    let data = get_data(app)?;
    let Some(site) = data.websites.get(index) else {
        return Ok(());
    };
    let label = format!("site-{index}");

    // Hide all other site webviews
    hide_site_webviews(app, Some(&label));

    // If webview already exists, show it and navigate
    if let Some(webview) = app.get_webview(&label) {
        let _ = webview.show();
        let _ = webview.eval(&format!("window.location.href = '{}';", site.url));
        // Refit in case window was resized
        let Some(window) = app.get_window("main") else {
            return Ok(());
        };
        if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
            let lw = size.width as f64 / scale;
            let lh = size.height as f64 / scale;
            let _ = webview.set_position(LogicalPosition::new(0.0, TAB_BAR_HEIGHT));
            let _ = webview.set_size(LogicalSize::new(lw, lh - TAB_BAR_HEIGHT));
        }
        return Ok(());
    }

    // Create new webview inside the main window
    let Some(window) = app.get_window("main") else {
        return Err("Main window not found".into());
    };

    let win_size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let lw = win_size.width as f64 / scale;
    let lh = win_size.height as f64 / scale;

    let external_url = Url::parse(&site.url).map_err(|e| e.to_string())?;

    window
        .add_child(
            WebviewBuilder::new(&label, WebviewUrl::External(external_url)),
            LogicalPosition::new(0.0, TAB_BAR_HEIGHT),
            LogicalSize::new(lw, lh - TAB_BAR_HEIGHT),
        )
        .map_err(|e| format!("Failed to create webview: {e}"))?;

    Ok(())
}

// --- Shortcuts ---

fn register_shortcuts(app: &tauri::App) -> tauri::Result<()> {
    let app_handle = app.handle();

    let alt = Some(Modifiers::ALT);
    let meta = if cfg!(target_os = "macos") {
        Some(Modifiers::META)
    } else {
        Some(Modifiers::CONTROL)
    };

    let toggle = Shortcut::new(alt, Code::Space);
    let fullscreen = Shortcut::new(alt, Code::Enter);
    let left = Shortcut::new(alt, Code::ArrowLeft);
    let right = Shortcut::new(alt, Code::ArrowRight);
    let up = Shortcut::new(alt, Code::ArrowUp);
    let down = Shortcut::new(alt, Code::ArrowDown);
    let scratch = Shortcut::new(meta, Code::Backquote);
    let back_nav = Shortcut::new(meta, Code::ArrowLeft);
    let fwd_nav = Shortcut::new(meta, Code::ArrowRight);
    let reset_nav = Shortcut::new(meta, Code::Enter);
    let home_tab = Shortcut::new(meta, Code::Digit0);
    let alt_tab = Shortcut::new(alt, Code::Tab);
    let alt_shift_tab = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::Tab);

    let number_shortcuts: Vec<(usize, Shortcut)> = (1..=MAX_WEBSITES)
        .map(|n| {
            let code = match n {
                1 => Code::Digit1,
                2 => Code::Digit2,
                3 => Code::Digit3,
                4 => Code::Digit4,
                5 => Code::Digit5,
                6 => Code::Digit6,
                7 => Code::Digit7,
                8 => Code::Digit8,
                9 => Code::Digit9,
                _ => Code::Digit0,
            };
            (n, Shortcut::new(meta, code))
        })
        .collect();

    let gs = app.global_shortcut();

    // Alt+Space: toggle visibility
    let handler_app = app_handle.clone();
    if let Err(e) =
        gs.on_shortcut(toggle.clone(), move |_app, shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed || shortcut != &toggle {
                return;
            }
            let ah = handler_app.clone();
            tauri::async_runtime::spawn(async move {
                toggle_visibility(&ah);
            });
        })
    {
        eprintln!("shortcut register failed (toggle): {e}");
    }

    // Alt+Arrow: snap window
    let resize_app = app_handle.clone();
    for (shortcut, pos) in &[
        (left.clone(), WindowPosition::Left),
        (right.clone(), WindowPosition::Right),
        (up.clone(), WindowPosition::Top),
        (down.clone(), WindowPosition::Bottom),
    ] {
        let s = shortcut.clone();
        let pos = *pos;
        let ra = resize_app.clone();
        if let Err(e) = gs.on_shortcut(s, move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let ah = ra.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = resize_active_window(&ah, pos).await {
                    eprintln!("resize failed: {e}");
                }
            });
        }) {
            eprintln!("shortcut register failed (resize): {e}");
        }
    }

    // Alt+Enter: fullscreen
    let fullscreen_app = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        fullscreen.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if let Some(win) = find_active_window(&fullscreen_app) {
                let _ = win.set_fullscreen(!win.is_fullscreen().unwrap_or(false));
            }
        },
    ) {
        eprintln!("shortcut register failed (fullscreen): {e}");
    }

    // Meta+ArrowLeft: back navigation
    let nav_app = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        back_nav.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if let Some(win) = find_active_window(&nav_app) {
                let _ = win.eval("history.back()");
            }
        },
    ) {
        eprintln!("shortcut register failed (back): {e}");
    }

    // Meta+ArrowRight: forward navigation
    let nav_app_fwd = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        fwd_nav.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if let Some(win) = find_active_window(&nav_app_fwd) {
                let _ = win.eval("history.forward()");
            }
        },
    ) {
        eprintln!("shortcut register failed (forward): {e}");
    }

    // Meta+Enter: reset history
    let nav_app_reset = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        reset_nav.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let _ = nav_app_reset.emit("reset-history", ());
        },
    ) {
        eprintln!("shortcut register failed (reset): {e}");
    }

    // Meta+Backtick: scratch tab
    let scratch_app = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        scratch.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let _ = scratch_app.emit("select-tab", "scratch");
            if let Some(win) = scratch_app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        },
    ) {
        eprintln!("shortcut register failed (scratch): {e}");
    }

    // Meta+0: home tab
    let home_app = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        home_tab.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let _ = home_app.emit("select-tab", "home");
            if let Some(win) = home_app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        },
    ) {
        eprintln!("shortcut register failed (home): {e}");
    }

    // Alt+Tab / Alt+Shift+Tab: cycle windows
    let cycle_app = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        alt_tab.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            cycle_windows(&cycle_app, true);
        },
    ) {
        eprintln!("shortcut register failed (alt+tab): {e}");
    }
    let cycle_app_back = app_handle.clone();
    if let Err(e) = gs.on_shortcut(
        alt_shift_tab.clone(),
        move |_app, _shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            cycle_windows(&cycle_app_back, false);
        },
    ) {
        eprintln!("shortcut register failed (alt+shift+tab): {e}");
    }

    // Meta+1..9: open/focus site in main window
    for (idx, shortcut) in number_shortcuts {
        let app_for_num = app_handle.clone();
        if let Err(e) = gs.on_shortcut(
            shortcut.clone(),
            move |_app, _shortcut, event: ShortcutEvent| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                let ah = app_for_num.clone();
                let site_index = idx - 1;
                let tab_id = format!("site-{site_index}");
                let _ = ah.emit("select-tab", &tab_id);
                if let Some(win) = ah.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = open_site_in_window(&ah, site_index).await {
                        eprintln!("Failed to open site: {e}");
                    }
                });
            },
        ) {
            eprintln!("shortcut register failed (number {idx}): {e}");
        }
    }

    Ok(())
}

// --- Tauri Commands ---

#[tauri::command]
async fn get_websites(app_handle: tauri::AppHandle) -> Result<Vec<Website>, String> {
    Ok(get_data(&app_handle)?.websites)
}

#[tauri::command]
async fn add_website_cmd(
    app_handle: tauri::AppHandle,
    website: WebsiteInput,
) -> Result<Vec<Website>, String> {
    let websites = add_website(&app_handle, website)?;
    let _ = app_handle.emit("websites-updated", websites.clone());
    Ok(websites)
}

#[tauri::command]
async fn remove_website_cmd(
    app_handle: tauri::AppHandle,
    index: usize,
) -> Result<Vec<Website>, String> {
    let websites = remove_website(&app_handle, index)?;
    let _ = app_handle.emit("websites-updated", websites.clone());
    Ok(websites)
}

#[tauri::command]
async fn reorder_websites_cmd(
    app_handle: tauri::AppHandle,
    websites: Vec<Website>,
) -> Result<Vec<Website>, String> {
    let websites = reorder_websites(&app_handle, websites)?;
    let _ = app_handle.emit("websites-updated", websites.clone());
    Ok(websites)
}

#[tauri::command]
async fn get_window_sizes_cmd(app_handle: tauri::AppHandle) -> Result<WindowSizes, String> {
    get_window_sizes(&app_handle)
}

#[tauri::command]
async fn save_window_sizes_cmd(
    app_handle: tauri::AppHandle,
    sizes: WindowSizes,
) -> Result<WindowSizes, String> {
    let sizes = save_window_sizes(&app_handle, sizes)?;
    let _ = app_handle.emit("window-sizes-updated", sizes.clone());
    Ok(sizes)
}

#[tauri::command]
async fn get_scratch_text_cmd(app_handle: tauri::AppHandle) -> Result<String, String> {
    get_scratch_text(&app_handle)
}

#[tauri::command]
async fn set_scratch_text_cmd(
    app_handle: tauri::AppHandle,
    text: String,
) -> Result<String, String> {
    let text = set_scratch_text(&app_handle, text)?;
    let _ = app_handle.emit("scratch-text-updated", text.clone());
    Ok(text)
}

#[tauri::command]
async fn open_site_cmd(app_handle: tauri::AppHandle, index: usize) -> Result<(), String> {
    open_site_in_window(&app_handle, index).await
}

#[tauri::command]
async fn hide_site_webviews_cmd(app_handle: tauri::AppHandle) {
    hide_site_webviews(&app_handle, None);
}

// --- App Entry Point ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            register_shortcuts(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Resized(_)) {
                refit_site_webviews(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_websites,
            add_website_cmd,
            remove_website_cmd,
            reorder_websites_cmd,
            get_window_sizes_cmd,
            save_window_sizes_cmd,
            get_scratch_text_cmd,
            set_scratch_text_cmd,
            open_site_cmd,
            hide_site_webviews_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
