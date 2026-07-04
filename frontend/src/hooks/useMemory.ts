import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

// Types matching Rust RPC response structs (snake_case from serde)

interface MemoryReadResponse {
  content: string;
  exists: boolean;
  last_modified: string;
}

interface MemoryWriteResponse {
  success: boolean;
  error?: string;
}

interface SnapshotEntry {
  filename: string;
  date: string;
  size_bytes: number;
  entry_count: number;
}

interface SessionEntry {
  filename: string;
  date: string;
  time: string;
  agent: string;
  duration_minutes: number;
  summary_first_line: string;
  is_fallback: boolean;
}

interface MemoryFileReadResponse {
  content: string;
  exists: boolean;
}

// --- Tauri invoke wrappers (match #[tauri::command] names exactly) ---

async function readWorkspaceFile(filename: string): Promise<MemoryReadResponse> {
  try {
    return await invoke<MemoryReadResponse>("memory_read", { file: filename });
  } catch {
    return { content: "", exists: false, last_modified: "" };
  }
}

async function writeWorkspaceFile(filename: string, content: string): Promise<MemoryWriteResponse> {
  try {
    return await invoke<MemoryWriteResponse>("memory_write", { file: filename, content });
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

async function listSnapshots(): Promise<SnapshotEntry[]> {
  try {
    return await invoke<SnapshotEntry[]>("memory_list_snapshots");
  } catch {
    return [];
  }
}

async function listSessions(): Promise<SessionEntry[]> {
  try {
    return await invoke<SessionEntry[]>("memory_list_sessions");
  } catch {
    return [];
  }
}

async function readMemoryFile(path: string): Promise<MemoryFileReadResponse> {
  try {
    return await invoke<MemoryFileReadResponse>("memory_read_file", { path });
  } catch {
    return { content: "", exists: false };
  }
}

// --- PTY bridge helpers (called from terminal component) ---

export async function createSessionBuffer(tabId: string, agentId: string, sessionStart: string) {
  try {
    await invoke("memory_create_buffer", {
      tabId,
      agentId,
      sessionStart,
    });
  } catch (e) {
    console.warn("Failed to create session buffer:", e);
  }
}

export async function pushPtyLine(tabId: string, line: string) {
  try {
    await invoke("memory_push_pty_line", { tabId, line });
  } catch {
    // Silently ignore — PTY buffering is best-effort
  }
}

export async function notifyTabClosed(tabId: string) {
  try {
    await invoke("memory_tab_closed", { tabId });
  } catch (e) {
    console.warn("Silent memory turn failed:", e);
  }
}

/** Notify gateway that a memory file changed — triggers re-injection (Contract 5). */
export async function notifyMemoryChanged(file: string) {
  try {
    await invoke<MemoryWriteResponse>("memory_notify_changed", { file });
  } catch (e) {
    console.warn("Memory change notification failed:", e);
  }
}

// --- React Query hooks ---

/** Read agentii.md or style.md */
export function useMemoryRead(file: "agentii.md" | "style.md") {
  return useQuery({
    queryKey: ["memory", "read", file],
    queryFn: () => readWorkspaceFile(file),
    staleTime: 5000,
  });
}

/** Write agentii.md or style.md, invalidates read cache on success */
export function useMemoryWrite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, content }: { file: string; content: string }) =>
      writeWorkspaceFile(file, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["memory", "read", variables.file] });
    },
  });
}

/** List all snapshot files sorted by date descending */
export function useSnapshotList() {
  return useQuery({
    queryKey: ["memory", "snapshots"],
    queryFn: listSnapshots,
    staleTime: 10000,
  });
}

/** List all session files sorted by date/time descending */
export function useSessionList() {
  return useQuery({
    queryKey: ["memory", "sessions"],
    queryFn: listSessions,
    staleTime: 10000,
  });
}

/** Read a specific snapshot or session file by relative path */
export function useMemoryFileRead(path: string | null) {
  return useQuery({
    queryKey: ["memory", "file", path],
    queryFn: () => (path ? readMemoryFile(path) : Promise.resolve({ content: "", exists: false })),
    enabled: !!path,
    staleTime: 5000,
  });
}

export type {
  MemoryReadResponse,
  MemoryWriteResponse,
  SnapshotEntry,
  SessionEntry,
  MemoryFileReadResponse,
};
