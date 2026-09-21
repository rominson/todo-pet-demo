use std::sync::{Arc, Mutex};
use std::thread;

use tauri::Manager;

// 命中区状态：JS 把「当前可点区域」(宠物可见身体矩形 + 环上12只 + 菜单/面板矩形) 按窗口本地逻辑像素
// (左上原点) 算好推过来；Rust 轮询全局光标，光标落在任一矩形内(或正在拖拽)就 window 吃点击，
// 否则让窗口忽略鼠标事件，透明区的点击就透传给桌面/其它 App。
#[derive(Default)]
struct HitState {
  rects: Vec<(f64, f64, f64, f64)>, // x,y,w,h —— 窗口本地逻辑像素，左上原点
  dragging: bool,
  #[cfg(target_os = "macos")]
  ns_window: usize, // NSWindow 裸指针(转 usize 存)，仅用于「读取」frame / 全局光标
  spawned: bool,
}

#[cfg(target_os = "macos")]
mod clickthru {
  use super::HitState;
  use std::sync::{Arc, Mutex};
  use std::thread;
  use std::time::Duration;

  use objc2::encode::{Encode, Encoding};
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject};

  use tauri::WebviewWindow;

  #[repr(C)]
  struct NSPt {
    x: f64,
    y: f64,
  }
  #[repr(C)]
  struct NSSz {
    width: f64,
    height: f64,
  }
  #[repr(C)]
  struct NSRc {
    origin: NSPt,
    size: NSSz,
  }

  // objc2 的 msg_send 要求返回类型实现 Encode（ABI 编码）。NSPoint/NSRect 是「两个 double」的结构体，
  // 名字字符串不影响内存布局，按此实现即可让 macOS 全局坐标(frame / mouseLocation)正确返回。
  unsafe impl Encode for NSPt {
    const ENCODING: Encoding = Encoding::Struct("NSPoint", &[Encoding::Double, Encoding::Double]);
  }
  unsafe impl Encode for NSSz {
    const ENCODING: Encoding = Encoding::Struct("NSSize", &[Encoding::Double, Encoding::Double]);
  }
  unsafe impl Encode for NSRc {
    const ENCODING: Encoding = Encoding::Struct("NSRect", &[NSPt::ENCODING, NSSz::ENCODING]);
  }

  // ⚠️ 主线程铁律：NSWindow 的 ignoresMouseEvents / level 属「窗口管理标签(WM tag)」，
  // 只能在主线程改；在子线程直接 msg_send 会触发 AppKit 断言
  // "Must only be used from the main thread" → EXC_BREAKPOINT(SIGTRAP) 秒崩（已踩过）。
  // 所以本循环只做「读取」(NSEvent.mouseLocation / NSWindow.frame，都是纯 getter)，
  // 真正的写操作交给 Tauri 高层 API `set_ignore_cursor_events`——它内部 send_user_message
  // 把改动投递到主线程事件循环执行，天然安全。
  pub(super) fn hit_loop(state: Arc<Mutex<HitState>>, win: WebviewWindow) {
    unsafe {
      // NSEvent 类对象指针：类方法 mouseLocation 返回全局光标(屏幕全局坐标，左下原点，点)
      let cname = std::ffi::CString::new("NSEvent").unwrap();
      let cls = AnyClass::get(&cname).unwrap() as *const AnyClass as *mut AnyObject;

      let mut prev: Option<bool> = None;
      loop {
        thread::sleep(Duration::from_millis(16));
        let (ns, dragging, rects) = {
          let s = state.lock().unwrap();
          (s.ns_window, s.dragging, s.rects.clone())
        };
        if ns == 0 {
          continue;
        }
        let ns = ns as *mut AnyObject;
        // NSWindow.frame 与 NSEvent.mouseLocation 同坐标系：屏幕全局、左下原点、点(逻辑像素)。
        // 与我们的矩形(窗口本地、左上原点、逻辑像素)对齐：
        //   窗口本地 x       = 光标全局x - frame.origin.x
        //   窗口本地 y(左上) = frame.size.height - (光标全局y - frame.origin.y)
        let loc: NSPt = msg_send![cls, mouseLocation];
        let f: NSRc = msg_send![ns, frame];
        let local_x = loc.x - f.origin.x;
        let local_y_top = f.size.height - (loc.y - f.origin.y);

        // 安全阀：rects 为空 = JS 还没推过命中区(启动瞬间/异常) → 保持窗口可点。
        // 否则一旦命中区为空就会把窗口设成全穿透，用户连宠物都点不动，等于把 App 弄砖。
        let mut inside = dragging || rects.is_empty();
        if !rects.is_empty() {
          for &(rx, ry, rw, rh) in &rects {
            if local_x >= rx && local_x <= rx + rw && local_y_top >= ry && local_y_top <= ry + rh {
              inside = true;
              break;
            }
          }
        }
        let ignore = !inside; // 透明区 → 忽略鼠标(透传)；可点区 → 不忽略(窗口吃点击)
        if prev != Some(ignore) {
          prev = Some(ignore);
          // 内部投递到主线程执行，切勿改成裸 msg_send
          let _ = win.set_ignore_cursor_events(ignore);
        }
      }
    }
  }
}

#[tauri::command]
fn set_hit_rects(
  state: tauri::State<Arc<Mutex<HitState>>>,
  rects: Vec<(f64, f64, f64, f64)>,
  dragging: bool,
) {
  let mut s = state.lock().unwrap();
  s.rects = rects;
  s.dragging = dragging;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .setup(|app| {
      let hit: Arc<Mutex<HitState>> = Arc::new(Mutex::new(HitState::default()));

      // macOS：把窗口层级调到菜单栏之上（NSMainMenuWindowLevel=24），
      // 这样无边框窗口才能贴到屏幕最顶、被拖到菜单栏区域，宠物无需再留系统保留区边距。
      // 同时捕获 NSWindow 指针并启动光标轮询，实现「仅宠物身体可点、透明区透传」。
      #[cfg(target_os = "macos")]
      {
        if let Some(win) = app.get_webview_window("main") {
          let hit = Arc::clone(&hit);
          let win_for_loop = win.clone();
          let _ = win.with_webview(move |webview| {
            use objc2::msg_send;
            unsafe {
              let ns: *mut objc2::runtime::AnyObject = webview.ns_window() as *mut _;
              // with_webview 的回调在主线程执行，所以这里的 setLevel 是安全的
              let _: () = msg_send![ns, setLevel: 26i64];
              let mut s = hit.lock().unwrap();
              s.ns_window = ns as usize;
              if !s.spawned {
                s.spawned = true;
                let h = Arc::clone(&hit);
                drop(s);
                thread::spawn(move || clickthru::hit_loop(h, win_for_loop));
              }
            }
          });
        }
      }

      app.manage(hit.clone());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![set_hit_rects])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
