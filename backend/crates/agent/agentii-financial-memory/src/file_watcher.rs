//! notify-based file watcher for agentii.md and style.md.
use crate::{AgentiiMdParser, ContextFileGenerator};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

pub struct FinancialMemoryWatcher {
    _watcher: RecommendedWatcher,
}

impl FinancialMemoryWatcher {
    /// Start watching workspace_root for agentii.md / style.md changes.
    /// Debounce: 500ms. On change: re-parse and regenerate all context files.
    pub fn start(workspace_root: PathBuf) -> Result<Self, notify::Error> {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
        let mut watcher = notify::recommended_watcher(tx)?;
        watcher.watch(&workspace_root, RecursiveMode::NonRecursive)?;

        let root = workspace_root.clone();
        std::thread::spawn(move || {
            let mut last_event = std::time::Instant::now();
            for res in rx {
                if let Ok(event) = res {
                    let is_relevant = event.paths.iter().any(|p| {
                        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        name == "agentii.md" || name == "style.md"
                    });
                    if is_relevant {
                        let now = std::time::Instant::now();
                        if now.duration_since(last_event) > Duration::from_millis(500) {
                            last_event = now;
                            let parsed = AgentiiMdParser::parse(&root);
                            ContextFileGenerator::regenerate_all(&root, &parsed);
                            tracing::info!("agentii memory: regenerated context files");
                        }
                    }
                }
            }
        });

        Ok(Self { _watcher: watcher })
    }
}
