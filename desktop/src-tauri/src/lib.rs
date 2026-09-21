#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .setup(|app| {
      // macOS：把窗口层级调到菜单栏之上（NSMainMenuWindowLevel=24），
      // 这样无边框窗口才能贴到屏幕最顶、被拖到菜单栏区域，宠物无需再留系统保留区边距。
      #[cfg(target_os = "macos")]
      {
        use tauri::Manager;
        if let Some(win) = app.get_webview_window("main") {
          let _ = win.with_webview(|webview| {
            use objc2::msg_send;
            unsafe {
              let ns: *mut objc2::runtime::AnyObject = webview.ns_window() as *mut _;
              let _: () = msg_send![ns, setLevel: 26i64];
            }
          });
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
