use tracing::debug;

/// Route identifier extracted from WebSocket upgrade path.
#[derive(Debug, Clone)]
pub enum Route {
    /// /ws/terminal/{project_id}/{terminal_id} — PTY proxy relay scoped to a project workspace
    Terminal {
        project_id: String,
        terminal_id: String,
        cli_id: Option<String>,
        /// Optional TERM override (e.g., "xterm" for goose/reedline compatibility)
        term_override: Option<String>,
    },
    /// /ws/agent or /ws/agent/{session_id} — structured API (Channel 2)
    Agent,
    /// /ws/chat — legacy chat WebSocket (reuses Agent handler)
    Chat,
    /// Unknown route
    NotFound(String),
}

impl Route {
    /// Parse a URI path into a route.
    ///
    /// Terminal route requires two segments: `/ws/terminal/{project_id}/{terminal_id}`
    /// Optional query parameter `cli` specifies which CLI agent to spawn (e.g., cli=goose).
    pub fn from_path(path: &str) -> Self {
        debug!(path = %path, "Parsing WebSocket route");
        // Split path and query string
        let (path_only, query) = path.split_once('?').unwrap_or((path, ""));
        let mut cli_id = None;
        let mut term_override = None;
        if !query.is_empty() {
            for pair in query.split('&') {
                let mut kv = pair.splitn(2, '=');
                if let (Some(key), Some(val)) = (kv.next(), kv.next()) {
                    if key == "cli" && !val.is_empty() {
                        cli_id = Some(val.to_string());
                    }
                    if key == "term" && !val.is_empty() {
                        term_override = Some(val.to_string());
                    }
                }
            }
        }
        if let Some(rest) = path_only.strip_prefix("/ws/terminal/") {
            let segments: Vec<&str> = rest.trim_matches('/').splitn(2, '/').collect();
            match segments.as_slice() {
                [project_id, terminal_id] if !project_id.is_empty() && !terminal_id.is_empty() => {
                    Route::Terminal {
                        project_id: project_id.to_string(),
                        terminal_id: terminal_id.to_string(),
                        cli_id,
                        term_override,
                    }
                }
                _ => Route::NotFound(path.to_string()),
            }
        } else if path_only == "/ws/agent"
            || path_only == "/ws/agent/"
            || path_only.starts_with("/ws/agent/")
        {
            Route::Agent
        } else if path_only == "/ws/chat" || path_only == "/ws/chat/" {
            Route::Chat
        } else {
            Route::NotFound(path.to_string())
        }
    }
}

/// WebSocket routing configuration.
pub struct GatewayRouter {
    /// Port the gateway listens on.
    pub port: u16,
}

impl GatewayRouter {
    pub fn new(port: u16) -> Self {
        Self { port }
    }

    /// Extract route from a WebSocket upgrade request path.
    pub fn route_request(&self, path: &str) -> Route {
        let route = Route::from_path(path);
        debug!(path = %path, route = ?route, "Routing WebSocket request");
        route
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_terminal_route() {
        let route = Route::from_path("/ws/terminal/proj-42/abc-123");
        match route {
            Route::Terminal {
                project_id,
                terminal_id,
                cli_id,
                term_override,
            } => {
                assert_eq!(project_id, "proj-42");
                assert_eq!(terminal_id, "abc-123");
                assert_eq!(cli_id, None);
                assert_eq!(term_override, None);
            }
            _ => panic!("Expected Terminal route"),
        }
    }

    #[test]
    fn test_terminal_route_missing_terminal_id() {
        // Only one segment → NotFound (project_id present but no terminal_id)
        let route = Route::from_path("/ws/terminal/proj-42");
        assert!(matches!(route, Route::NotFound(_)));
    }

    #[test]
    fn test_agent_route() {
        let route = Route::from_path("/ws/agent");
        assert!(matches!(route, Route::Agent));
    }

    #[test]
    fn test_unknown_route() {
        let route = Route::from_path("/ws/unknown");
        assert!(matches!(route, Route::NotFound(_)));
    }

    #[test]
    fn test_empty_terminal_id() {
        let route = Route::from_path("/ws/terminal/");
        assert!(matches!(route, Route::NotFound(_)));
    }

    #[test]
    fn test_terminal_route_empty_segments() {
        let route = Route::from_path("/ws/terminal//");
        assert!(matches!(route, Route::NotFound(_)));
    }

    #[test]
    fn test_terminal_route_with_cli_and_term() {
        let route = Route::from_path("/ws/terminal/proj-42/abc-123?cli=goose&term=xterm");
        match route {
            Route::Terminal {
                project_id,
                terminal_id,
                cli_id,
                term_override,
            } => {
                assert_eq!(project_id, "proj-42");
                assert_eq!(terminal_id, "abc-123");
                assert_eq!(cli_id, Some("goose".to_string()));
                assert_eq!(term_override, Some("xterm".to_string()));
            }
            _ => panic!("Expected Terminal route"),
        }
    }

    #[test]
    fn test_terminal_route_with_term_only() {
        let route = Route::from_path("/ws/terminal/proj-42/abc-123?term=xterm");
        match route {
            Route::Terminal { cli_id, term_override, .. } => {
                assert_eq!(cli_id, None);
                assert_eq!(term_override, Some("xterm".to_string()));
            }
            _ => panic!("Expected Terminal route"),
        }
    }
}
