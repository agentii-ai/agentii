import { useState, useCallback } from "react";
import { useMemoryRead, useMemoryWrite } from "../../hooks/useMemory";
import { MarkdownToggle, useMarkdownToggle } from "./MarkdownToggle";

const CANONICAL_SECTIONS = [
  "Investment Philosophy",
  "Trading Execution",
  "Analysis Preferences",
  "Output Formatting",
  "Risk Framework",
];

// --- Preset options for FR-030 form controls ---

const APPROACH_OPTIONS = ["Growth", "Value", "GARP", "Momentum", "Income", "Quantitative", "Technical", "Hybrid"];
const TIME_HORIZON_OPTIONS = ["Intraday", "Days–Weeks", "1–6 Months", "6–18 Months", "1–3 Years", "3+ Years"];
const VALUATION_OPTIONS = ["DCF", "Comparables", "Sum-of-Parts", "Dividend Discount", "Asset-Based"];
const SCENARIO_COUNT_OPTIONS = ["1", "2", "3", "4", "5"];
const CITATION_OPTIONS = ["Always cite source and page", "Cite source only", "Inline links", "Footnotes", "No citations"];
const PRESENTATION_OPTIONS = ["Conclusion first, then evidence", "Evidence first, then conclusion", "Chronological", "By importance"];
const LENGTH_OPTIONS = ["Concise (1 page max)", "Standard (2–3 pages)", "Detailed (no limit)"];

interface StyleBlock {
  id: string;
  heading: string;
  content: string;
}

/** Extract a `- Key: Value` field from markdown block content. */
function extractField(content: string, key: string): string {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`- ${key}:`)) {
      return trimmed.slice(`- ${key}:`.length).trim();
    }
  }
  return "";
}

/** Set a `- Key: Value` field in markdown block content. Creates the line if missing. */
function setField(content: string, key: string, value: string): string {
  const prefix = `- ${key}:`;
  const lines = content.split("\n");
  let found = false;
  const updated = lines.map((line) => {
    if (line.trim().startsWith(prefix)) {
      found = true;
      return `- ${key}: ${value}`;
    }
    return line;
  });
  if (!found) {
    updated.push(`- ${key}: ${value}`);
  }
  return updated.join("\n").trim();
}

function parseStyleBlocks(markdown: string): StyleBlock[] {
  const lines = markdown.split("\n");
  const blocks: StyleBlock[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];
  let blockIndex = 0;
  let inComment = false;

  for (const line of lines) {
    if (inComment) {
      if (line.includes("-->")) {
        inComment = false;
      }
      continue;
    }

    if (line.startsWith("<!--")) {
      if (!line.includes("-->")) {
        inComment = true;
      }
      continue;
    }

    if (line.startsWith("## ")) {
      if (currentHeading || currentContent.length > 0) {
        blocks.push({
          id: `style-${blockIndex++}`,
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = line.slice(3).trim();
      currentContent = [];
    } else if (line.startsWith("# ")) {
      continue;
    } else {
      currentContent.push(line);
    }
  }

  if (currentHeading || currentContent.length > 0) {
    blocks.push({
      id: `style-${blockIndex}`,
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  for (const section of CANONICAL_SECTIONS) {
    if (!blocks.find((b) => b.heading === section)) {
      blocks.push({
        id: `style-${blockIndex++}-${section}`,
        heading: section,
        content: "",
      });
    }
  }

  return blocks;
}

function serializeStyleBlocks(blocks: StyleBlock[]): string {
  const header = "# Investment & Analysis Style\n";
  const body = blocks
    .filter((b) => b.heading)
    .map((b) => (b.content ? `## ${b.heading}\n${b.content}` : `## ${b.heading}`))
    .join("\n\n");
  return `${header}\n${body}\n`;
}

// --- Form control sub-components ---

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const isCustom = value !== "" && !options.some((o) => value.startsWith(o));
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <label className="text-xs text-zinc-400 w-36 shrink-0">{label}</label>
      <select
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value !== "__custom__") onChange(e.target.value);
        }}
        className="flex-1 bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
        aria-label={label}
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {isCustom && (
          <option value="__custom__" disabled>
            Custom: {value}
          </option>
        )}
      </select>
    </div>
  );
}

function MultiSelectField({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="mb-1.5">
      <label className="text-xs text-zinc-400 block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              selected.includes(o)
                ? "bg-blue-600/30 border-blue-500 text-blue-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <label className="text-xs text-zinc-400 w-36 shrink-0">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
        aria-label={label}
      />
      {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
    </div>
  );
}

// --- Section-specific form renderers ---

function InvestmentPhilosophyForm({
  content,
  onChange,
}: {
  content: string;
  onChange: (c: string) => void;
}) {
  const approach = extractField(content, "Approach");
  const horizon = extractField(content, "Time Horizon");
  return (
    <>
      <SelectField
        label="Approach"
        value={approach}
        options={APPROACH_OPTIONS}
        onChange={(v) => onChange(setField(content, "Approach", v))}
      />
      <SelectField
        label="Time Horizon"
        value={horizon}
        options={TIME_HORIZON_OPTIONS}
        onChange={(v) => onChange(setField(content, "Time Horizon", v))}
      />
      <FreeformFields content={content} excludeKeys={["Approach", "Time Horizon"]} onChange={onChange} />
    </>
  );
}

function AnalysisPreferencesForm({
  content,
  onChange,
}: {
  content: string;
  onChange: (c: string) => void;
}) {
  const valRaw = extractField(content, "Valuation");
  const selectedMethods = VALUATION_OPTIONS.filter((o) => valRaw.includes(o));
  const scenarioRaw = extractField(content, "Scenario Modeling");
  const scenarioMatch = scenarioRaw.match(/(\d+)\s*scenario/i);
  const scenarioCount = scenarioMatch ? scenarioMatch[1] : "";

  return (
    <>
      <MultiSelectField
        label="Valuation Methods"
        selected={selectedMethods}
        options={VALUATION_OPTIONS}
        onChange={(methods) => {
          const val = methods.length > 0 ? methods.join(", ") : "";
          onChange(setField(content, "Valuation", val));
        }}
      />
      <SelectField
        label="Scenario Count"
        value={scenarioCount}
        options={SCENARIO_COUNT_OPTIONS}
        onChange={(v) =>
          onChange(
            setField(content, "Scenario Modeling", `${v} scenarios with probability weights`),
          )
        }
      />
      <FreeformFields
        content={content}
        excludeKeys={["Valuation", "Scenario Modeling"]}
        onChange={onChange}
      />
    </>
  );
}

function OutputFormattingForm({
  content,
  onChange,
}: {
  content: string;
  onChange: (c: string) => void;
}) {
  const citation = extractField(content, "Citation Style");
  const presentation = extractField(content, "Presentation");
  const length = extractField(content, "Length");

  return (
    <>
      <SelectField
        label="Citation Style"
        value={citation}
        options={CITATION_OPTIONS}
        onChange={(v) => onChange(setField(content, "Citation Style", v))}
      />
      <SelectField
        label="Presentation"
        value={presentation}
        options={PRESENTATION_OPTIONS}
        onChange={(v) => onChange(setField(content, "Presentation", v))}
      />
      <SelectField
        label="Length"
        value={length}
        options={LENGTH_OPTIONS}
        onChange={(v) => onChange(setField(content, "Length", v))}
      />
      <FreeformFields
        content={content}
        excludeKeys={["Citation Style", "Presentation", "Length"]}
        onChange={onChange}
      />
    </>
  );
}

function RiskFrameworkForm({
  content,
  onChange,
}: {
  content: string;
  onChange: (c: string) => void;
}) {
  const maxPosition = extractField(content, "Max Single Position");
  const stopLoss = extractField(content, "Stop-Loss");
  const drawdown = extractField(content, "Drawdown Tolerance");

  return (
    <>
      <NumberField
        label="Max Single Position"
        value={maxPosition.replace(/%.*/, "%")}
        suffix="of portfolio"
        onChange={(v) => onChange(setField(content, "Max Single Position", v))}
      />
      <NumberField
        label="Stop-Loss"
        value={stopLoss}
        onChange={(v) => onChange(setField(content, "Stop-Loss", v))}
      />
      <NumberField
        label="Drawdown Tolerance"
        value={drawdown}
        onChange={(v) => onChange(setField(content, "Drawdown Tolerance", v))}
      />
      <FreeformFields
        content={content}
        excludeKeys={["Max Single Position", "Stop-Loss", "Drawdown Tolerance"]}
        onChange={onChange}
      />
    </>
  );
}

/** Render remaining `- Key: Value` lines as editable text for fields not covered by form controls. */
function FreeformFields({
  content,
  excludeKeys,
  onChange,
}: {
  content: string;
  excludeKeys: string[];
  onChange: (c: string) => void;
}) {
  const remaining = content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("- ")) return true;
      return !excludeKeys.some((k) => trimmed.startsWith(`- ${k}:`));
    })
    .join("\n")
    .trim();

  if (!remaining && excludeKeys.length > 0) return null;

  return (
    <textarea
      value={remaining}
      onChange={(e) => {
        // Rebuild: keep form-controlled fields, replace freeform portion
        const controlled = content
          .split("\n")
          .filter((line) => {
            const trimmed = line.trim();
            return excludeKeys.some((k) => trimmed.startsWith(`- ${k}:`));
          })
          .join("\n");
        const combined = controlled ? `${controlled}\n${e.target.value}` : e.target.value;
        onChange(combined.trim());
      }}
      rows={Math.max(2, remaining.split("\n").length + 1)}
      placeholder="Additional preferences..."
      className="w-full mt-2 bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded border border-zinc-700 resize-y focus:outline-none focus:border-blue-500 font-mono"
      aria-label="Additional preferences"
    />
  );
}

// --- Section form map ---

const SECTION_FORMS: Record<
  string,
  (props: { content: string; onChange: (c: string) => void }) => JSX.Element
> = {
  "Investment Philosophy": InvestmentPhilosophyForm,
  "Analysis Preferences": AnalysisPreferencesForm,
  "Output Formatting": OutputFormattingForm,
  "Risk Framework": RiskFrameworkForm,
};

/** Structured block editor for style.md (FR-030). */
export function StyleEditor() {
  const { data, isLoading } = useMemoryRead("style.md");
  const writeMutation = useMemoryWrite();
  const { isRawMode, setIsRawMode } = useMarkdownToggle();
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<StyleBlock[] | null>(null);
  const [dirty, setDirty] = useState(false);

  const content = data?.content ?? "";
  const currentBlocks = blocks ?? parseStyleBlocks(content);
  const currentRaw = rawContent ?? content;

  const handleBlockChange = useCallback(
    (blockId: string, value: string) => {
      const updated = currentBlocks.map((b) =>
        b.id === blockId ? { ...b, content: value } : b,
      );
      setBlocks(updated);
      setDirty(true);
    },
    [currentBlocks],
  );

  const handleSave = useCallback(() => {
    const markdown = isRawMode ? currentRaw : serializeStyleBlocks(currentBlocks);
    writeMutation.mutate(
      { file: "style.md", content: markdown },
      {
        onSuccess: () => {
          setDirty(false);
          if (isRawMode) {
            setBlocks(parseStyleBlocks(currentRaw));
          } else {
            setRawContent(serializeStyleBlocks(currentBlocks));
          }
        },
      },
    );
  }, [isRawMode, currentRaw, currentBlocks, writeMutation]);

  if (isLoading) {
    return <div className="p-4 text-zinc-400">Loading style.md...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700">
        <h2 className="text-sm font-medium text-zinc-200">Analysis Style</h2>
        <div className="flex items-center gap-2">
          <MarkdownToggle isRawMode={isRawMode} onToggle={setIsRawMode} />
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || writeMutation.isPending}
            className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {writeMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isRawMode ? (
          <textarea
            value={currentRaw}
            onChange={(e) => {
              setRawContent(e.target.value);
              setDirty(true);
            }}
            className="w-full h-full min-h-[400px] bg-zinc-900 text-zinc-200 font-mono text-sm p-3 rounded border border-zinc-700 resize-none focus:outline-none focus:border-blue-500"
            spellCheck={false}
          />
        ) : (
          <div className="space-y-4">
            {currentBlocks.map((block) => {
              const FormComponent = SECTION_FORMS[block.heading];
              return (
                <div
                  key={block.id}
                  className="border border-zinc-700 rounded-lg p-3 bg-zinc-900"
                >
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">
                    {block.heading}
                  </h3>
                  {FormComponent ? (
                    <FormComponent
                      content={block.content}
                      onChange={(c) => handleBlockChange(block.id, c)}
                    />
                  ) : (
                    <textarea
                      value={block.content}
                      onChange={(e) => handleBlockChange(block.id, e.target.value)}
                      rows={Math.max(3, block.content.split("\n").length + 1)}
                      placeholder={`Configure your ${block.heading.toLowerCase()} preferences...`}
                      className="w-full bg-zinc-800 text-zinc-300 text-sm px-2 py-1 rounded border border-zinc-700 resize-y focus:outline-none focus:border-blue-500 font-mono"
                      aria-label={`${block.heading} preferences`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
