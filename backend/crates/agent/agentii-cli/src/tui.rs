//! Minimal Ratatui TUI for `agentii chat --tui`.
//!
//! Provides a simple full-screen chat interface using ratatui + crossterm.
//! The TUI renders an input box at the bottom and a scrollable message log
//! above it. Press Enter to submit, Ctrl-C / Esc to quit.

use std::io;

use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Terminal,
};

/// A single message in the TUI chat log.
#[derive(Debug, Clone)]
pub struct TuiMessage {
    /// "user" or "assistant"
    pub role: String,
    pub text: String,
}

/// Minimal TUI application state.
pub struct TuiApp {
    messages: Vec<TuiMessage>,
    input: String,
    /// Whether the user has requested to quit.
    pub should_quit: bool,
}

impl TuiApp {
    /// Create a new, empty TUI application.
    #[must_use]
    pub fn new() -> Self {
        Self {
            messages: Vec::new(),
            input: String::new(),
            should_quit: false,
        }
    }

    /// Push a message into the chat log.
    pub fn push_message(&mut self, role: impl Into<String>, text: impl Into<String>) {
        self.messages.push(TuiMessage {
            role: role.into(),
            text: text.into(),
        });
    }

    /// Run the TUI event loop.
    ///
    /// Initialises the terminal, renders frames, and processes keyboard events
    /// until the user quits. Returns the final input buffer (if any) when the
    /// loop exits.
    ///
    /// # Errors
    /// Returns an `io::Error` if terminal setup or event polling fails.
    pub fn run(&mut self) -> io::Result<()> {
        // Set up terminal
        enable_raw_mode()?;
        let mut stdout = io::stdout();
        execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
        let backend = CrosstermBackend::new(stdout);
        let mut terminal = Terminal::new(backend)?;

        let result = self.event_loop(&mut terminal);

        // Restore terminal regardless of result
        disable_raw_mode()?;
        execute!(
            terminal.backend_mut(),
            LeaveAlternateScreen,
            DisableMouseCapture
        )?;
        terminal.show_cursor()?;

        result
    }

    fn event_loop<B: ratatui::backend::Backend>(
        &mut self,
        terminal: &mut Terminal<B>,
    ) -> io::Result<()> {
        loop {
            terminal.draw(|frame| self.render(frame))?;

            if event::poll(std::time::Duration::from_millis(50))? {
                if let Event::Key(key) = event::read()? {
                    match (key.code, key.modifiers) {
                        (KeyCode::Char('c'), KeyModifiers::CONTROL)
                        | (KeyCode::Esc, _) => {
                            self.should_quit = true;
                            break;
                        }
                        (KeyCode::Enter, _) => {
                            let text = self.input.trim().to_string();
                            if !text.is_empty() {
                                self.push_message("user", text);
                                self.input.clear();
                            }
                        }
                        (KeyCode::Backspace, _) => {
                            self.input.pop();
                        }
                        (KeyCode::Char(ch), _) => {
                            self.input.push(ch);
                        }
                        _ => {}
                    }
                }
            }
        }
        Ok(())
    }

    fn render(&self, frame: &mut ratatui::Frame) {
        let area = frame.area();

        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Min(3), Constraint::Length(3)])
            .split(area);

        // Message log
        let items: Vec<ListItem> = self
            .messages
            .iter()
            .map(|msg| {
                let style = if msg.role == "user" {
                    Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(Color::Green)
                };
                let line = Line::from(vec![
                    Span::styled(format!("[{}] ", msg.role), style),
                    Span::raw(msg.text.clone()),
                ]);
                ListItem::new(line)
            })
            .collect();

        let log = List::new(items).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" agentii chat "),
        );
        frame.render_widget(log, chunks[0]);

        // Input box
        let input_widget = Paragraph::new(self.input.as_str()).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" input (Enter to send, Esc to quit) "),
        );
        frame.render_widget(input_widget, chunks[1]);
    }
}

impl Default for TuiApp {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::TuiApp;

    #[test]
    fn tui_app_starts_empty_and_accepts_messages() {
        let mut app = TuiApp::new();
        assert!(!app.should_quit);
        app.push_message("user", "hello");
        assert_eq!(app.messages.len(), 1);
        assert_eq!(app.messages[0].role, "user");
        assert_eq!(app.messages[0].text, "hello");
    }
}
