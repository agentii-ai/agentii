// Config field types
export type ConfigFieldType = 'secret' | 'text' | 'select';
export type ConfigStatus = 'none' | 'needs_setup' | 'configured';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required: boolean;
  placeholder?: string;
  helpUrl?: string;
  options?: string[];  // For 'select' type only
  hasValue?: boolean;  // Populated by backend when returning list
}

export interface ConfigSchema {
  fields: ConfigField[];
  envMapping?: Record<string, string>;
}

// Skill types
export interface SkillEntry {
  id: string;
  name: string;
  path: string;
  requiresConfig: boolean;
}

export interface SkillRepo {
  id: string;
  name: string;
  author: string;
  repoUrl: string;
  description: string;
  enabled: boolean;
  configStatus: ConfigStatus;
  configFields: ConfigField[];
  skills: SkillEntry[];
}

export interface SkillCategory {
  id: string;
  label: string;
  repos: SkillRepo[];
}

export interface SkillsListResponse {
  categories: SkillCategory[];
}

// MCP types
export interface McpServer {
  id: string;
  name: string;
  description: string;
  transport: 'stdio' | 'sse' | 'streamable-http';
  enabled: boolean;
  configStatus: ConfigStatus;
  compatibility: string[];
  configFields: ConfigField[];
}

export interface McpListResponse {
  servers: McpServer[];
}

// RPC request/response types
export interface ConfigureRequest {
  repoId?: string;    // For skills
  serverId?: string;  // For MCP
  values: Record<string, string>;
}

export interface ConfigureResponse {
  ok: boolean;
  configStatus: ConfigStatus;
  error?: string;
  message?: string;
  warning?: string;
}

export interface ToggleRequest {
  repoId?: string;    // For skills
  serverId?: string;  // For MCP
  enabled: boolean;
}

export interface ToggleResponse {
  ok: boolean;
  warning?: string;
}
