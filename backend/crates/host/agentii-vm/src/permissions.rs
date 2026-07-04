use agentii_protocol::vm::PermissionTier;

/// Lima VM configuration overrides for each permission tier.
#[derive(Debug, Clone)]
pub struct TierConfig {
    /// Whether the workspace mount is writable.
    pub mount_writable: bool,
    /// Network access mode.
    pub network: NetworkMode,
    /// Whether to apply read-only remount on workspace.
    pub remount_readonly: bool,
    /// Allowed network domains for AutoEdit tier.
    pub allowed_domains: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum NetworkMode {
    /// No network access.
    Disabled,
    /// Only allowlisted hosts (LLM API endpoints).
    AllowlistOnly(Vec<String>),
    /// Full network access.
    Full,
}

impl TierConfig {
    /// Get configuration for a permission tier.
    pub fn for_tier(tier: PermissionTier) -> Self {
        match tier {
            PermissionTier::Suggest => Self {
                mount_writable: false,
                network: NetworkMode::Disabled,
                remount_readonly: true,
                allowed_domains: vec![],
            },
            PermissionTier::AutoEdit => Self {
                mount_writable: true,
                network: NetworkMode::AllowlistOnly(default_llm_allowlist()),
                remount_readonly: false,
                allowed_domains: default_package_registries(),
            },
            PermissionTier::FullAuto => Self {
                mount_writable: true,
                network: NetworkMode::Full,
                remount_readonly: false,
                allowed_domains: vec![],
            },
        }
    }

    /// Generate iptables rules for network restrictions inside VM.
    ///
    /// Rules always start with a flush and set the default policy, then add
    /// loopback + ESTABLISHED/RELATED before any tier-specific rules.
    pub fn iptables_rules(&self) -> Vec<String> {
        match &self.network {
            NetworkMode::Disabled => vec![
                "iptables -F OUTPUT".into(),
                "iptables -P OUTPUT DROP".into(),
                "iptables -A OUTPUT -o lo -j ACCEPT".into(),
                "iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT".into(),
            ],
            NetworkMode::AllowlistOnly(hosts) => {
                let mut rules = vec![
                    "iptables -F OUTPUT".into(),
                    "iptables -P OUTPUT DROP".into(),
                    "iptables -A OUTPUT -o lo -j ACCEPT".into(),
                    "iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT".into(),
                    "iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT".into(),
                    "iptables -A OUTPUT -p udp --dport 53 -j ACCEPT".into(),
                ];
                // Allow LLM API hosts
                for host in hosts {
                    rules.push(format!(
                        "iptables -A OUTPUT -p tcp -d {} --dport 443 -j ACCEPT",
                        host
                    ));
                }
                // Allow package registry domains from allowed_domains
                for domain in &self.allowed_domains {
                    rules.push(format!(
                        "iptables -A OUTPUT -p tcp -d {} --dport 443 -j ACCEPT",
                        domain
                    ));
                }
                rules
            }
            NetworkMode::Full => vec![],
        }
    }
}

/// Default package registry domains allowed for AutoEdit tier.
fn default_package_registries() -> Vec<String> {
    vec![
        "pypi.org".into(),
        "files.pythonhosted.org".into(),
        "registry.npmjs.org".into(),
        "github.com".into(),
        "objects.githubusercontent.com".into(),
    ]
}

fn default_llm_allowlist() -> Vec<String> {
    vec![
        "api.anthropic.com".into(),
        "api.openai.com".into(),
        "api.deepseek.com".into(),
        "generativelanguage.googleapis.com".into(),
        "api.groq.com".into(),
        "api.mistral.ai".into(),
        "openrouter.ai".into(),
    ]
}
