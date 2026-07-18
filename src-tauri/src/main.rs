#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

// Mirrors clap-plugin/soemdsp_sandbox_gui_proof.cpp's SpawnSidecarServer()/
// WaitForSidecarPort() -- same sidecar binary, same "poll a TCP connect"
// readiness check. Kept in sync deliberately: this Tauri app and the CLAP
// plugin GUI are two different native shells around the same sandbox
// server, and should launch it the same way.
const SIDECAR_PORT: u16 = 8765;
const SIDECAR_READY_TIMEOUT: Duration = Duration::from_secs(20);

struct SidecarState(Mutex<Option<CommandChild>>);

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

fn spawn_server(app: &tauri::AppHandle) -> Option<CommandChild> {
    let sidecar = app.shell().sidecar("soemdsp-server").ok()?;
    let (_receiver, child) = sidecar
        .args(["--host", "127.0.0.1", "--port", &SIDECAR_PORT.to_string()])
        .spawn()
        .ok()?;
    Some(child)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let child = spawn_server(&app_handle);
                if child.is_none() {
                    eprintln!("soemdsp-sandbox-native: failed to spawn sidecar server");
                }
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    *state.0.lock().unwrap() = child;
                }

                let ready = wait_for_server(SIDECAR_PORT, SIDECAR_READY_TIMEOUT);
                let url = if ready {
                    format!("http://127.0.0.1:{SIDECAR_PORT}/")
                } else {
                    eprintln!(
                        "soemdsp-sandbox-native: sidecar server did not become ready within {:?}",
                        SIDECAR_READY_TIMEOUT
                    );
                    "about:blank".to_string()
                };

                let app_handle_for_window = app_handle.clone();
                app_handle
                    .run_on_main_thread(move || {
                        let webview_url = WebviewUrl::External(url.parse().expect("invalid sidecar URL"));
                        WebviewWindowBuilder::new(&app_handle_for_window, "main", webview_url)
                            .title("Soemdsp Sandbox")
                            .inner_size(1400.0, 900.0)
                            .build()
                            .expect("failed to build main window");
                    })
                    .expect("failed to schedule window creation on main thread");
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    if let Some(state) = window.app_handle().try_state::<SidecarState>() {
                        if let Some(child) = state.0.lock().unwrap().take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running soemdsp-sandbox-native");
}
