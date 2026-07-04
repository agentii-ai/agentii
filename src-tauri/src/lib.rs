mod commands;
pub mod gateway;
mod security;
mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Spawn the agentii-gateway as a background tokio task
            let config_path = app
                .path()
                .app_config_dir()
                .ok()
                .map(|d| d.join("agentii.toml"))
                .and_then(|p| p.to_str().map(String::from));

            tauri::async_runtime::spawn(async move {
                if let Err(e) = gateway::start_gateway_background(config_path).await {
                    tracing::error!("Failed to start gateway: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::store_credentials,
            commands::auth::get_credentials,
            commands::auth::delete_credentials,
            commands::auth::has_credentials,
            commands::notifications::send_notification,
            commands::notifications::request_notification_permission,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::list_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
