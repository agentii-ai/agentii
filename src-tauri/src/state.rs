use serde::{Deserialize, Serialize};

#[derive(Default)]
pub struct AppState {
    pub notifications_enabled: bool,
}
