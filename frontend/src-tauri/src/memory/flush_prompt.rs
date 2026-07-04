/// Returns the memory flush system prompt template.
/// Used by session_capture to build the LLM prompt for the silent memory turn.
pub fn get_flush_prompt_template() -> &'static str {
    include_str!("../../templates/memory_flush_prompt.md")
}
