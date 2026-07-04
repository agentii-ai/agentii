#[tauri::command]
pub fn send_notification(title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "display notification \"{}\" with title \"{}\"",
                    body, title
                ),
            ])
            .output()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        // Windows toast notification via PowerShell
        let script = format!(
            "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; \
             $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
             $template.GetElementsByTagName('text')[0].AppendChild($template.CreateTextNode('{}')) > $null; \
             $template.GetElementsByTagName('text')[1].AppendChild($template.CreateTextNode('{}')) > $null; \
             [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Agentii').Show([Windows.UI.Notifications.ToastNotification]::new($template))",
            title, body
        );
        std::process::Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn request_notification_permission() -> bool {
    true
}
