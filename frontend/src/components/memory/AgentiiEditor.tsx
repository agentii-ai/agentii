import { useState, useCallback } from "react";
import { useMemoryRead, useMemoryWrite } from "../../hooks/useMemory";
import { MarkdownToggle, useMarkdownToggle } from "./MarkdownToggle";

interface Block {
  id: string;
  heading: string;
  content: string;
}

/** Parse markdown into blocks by ## headings. */
function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];
  let blockIndex = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentHeading || currentContent.length > 0) {
        blocks.push({
          id: `block-${blockIndex++}`,
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = line.slice(3).trim();
      currentContent = [];
    } else if (line.startsWith("# ") && blocks.length === 0 && !currentHeading) {
      // Top-level heading — treat as first block
      blocks.push({
        id: `block-${blockIndex++}`,
        heading: line.slice(2).trim(),
        content: "",
      });
    } else {
      currentContent.push(line);
    }
  }

  // Push last block
  if (currentHeading || currentContent.length > 0) {
    blocks.push({
      id: `block-${blockIndex}`,
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  return blocks;
}

/** Serialize blocks back to markdown. */
function serializeBlocks(blocks: Block[]): string {
  return blocks
    .map((b, i) => {
      const prefix = i === 0 && !b.heading.includes("—") ? `# ${b.heading}` : `## ${b.heading}`;
      return b.content ? `${prefix}\n${b.content}` : prefix;
    })
    .join("\n\n");
}

/** Structured block editor for agentii.md (FR-029). */
export function AgentiiEditor() {
  const { data, isLoading } = useMemoryRead("agentii.md");
  const writeMutation = useMemoryWrite();
  const { isRawMode, setIsRawMode } = useMarkdownToggle();
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [dirty, setDirty] = useState(false);

  // Initialize from loaded data
  const content = data?.content ?? "";
  const currentBlocks = blocks ?? parseBlocks(content);
  const currentRaw = rawContent ?? content;

  const handleBlockChange = useCallback(
    (blockId: string, field: "heading" | "content", value: string) => {
      const updated = currentBlocks.map((b) =>
        b.id === blockId ? { ...b, [field]: value } : b,
      );
      setBlocks(updated);
      setDirty(true);
    },
    [currentBlocks],
  );

  const handleAddBlock = useCallback(() => {
    const newBlock: Block = {
      id: `block-${Date.now()}`,
      heading: "New Section",
      content: "",
    };
    setBlocks([...currentBlocks, newBlock]);
    setDirty(true);
  }, [currentBlocks]);

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      if (!confirm("Delete this section?")) return;
      setBlocks(currentBlocks.filter((b) => b.id !== blockId));
      setDirty(true);
    },
    [currentBlocks],
  );

  const handleMoveBlock = useCallback(
    (blockId: string, direction: "up" | "down") => {
      const idx = currentBlocks.findIndex((b) => b.id === blockId);
      if (idx < 0) return;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= currentBlocks.length) return;
      const updated = [...currentBlocks];
      [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
      setBlocks(updated);
      setDirty(true);
    },
    [currentBlocks],
  );

  const handleSave = useCallback(() => {
    const markdown = isRawMode ? currentRaw : serializeBlocks(currentBlocks);
    writeMutation.mutate(
      { file: "agentii.md", content: markdown },
      {
        onSuccess: () => {
          setDirty(false);
          // Sync both views
          if (isRawMode) {
            setBlocks(parseBlocks(currentRaw));
          } else {
            setRawContent(serializeBlocks(currentBlocks));
          }
        },
      },
    );
  }, [isRawMode, currentRaw, currentBlocks, writeMutation]);

  if (isLoading) {
    return <div className="p-4 text-zinc-400">Loading agentii.md...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700">
        <h2 className="text-sm font-medium text-zinc-200">Project Memory</h2>
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
            {currentBlocks.map((block, idx) => (
              <div
                key={block.id}
                className="border border-zinc-700 rounded-lg p-3 bg-zinc-900"
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={block.heading}
                    onChange={(e) => handleBlockChange(block.id, "heading", e.target.value)}
                    className="flex-1 bg-zinc-800 text-zinc-200 text-sm font-medium px-2 py-1 rounded border border-zinc-600 focus:outline-none focus:border-blue-500"
                    aria-label={`Section heading ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(block.id, "up")}
                    disabled={idx === 0}
                    className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                    aria-label="Move section up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(block.id, "down")}
                    disabled={idx === currentBlocks.length - 1}
                    className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                    aria-label="Move section down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(block.id)}
                    className="p-1 text-red-400 hover:text-red-300"
                    aria-label="Delete section"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={block.content}
                  onChange={(e) => handleBlockChange(block.id, "content", e.target.value)}
                  rows={Math.max(3, block.content.split("\n").length + 1)}
                  className="w-full bg-zinc-800 text-zinc-300 text-sm px-2 py-1 rounded border border-zinc-700 resize-y focus:outline-none focus:border-blue-500 font-mono"
                  aria-label={`Content for ${block.heading}`}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddBlock}
              className="w-full py-2 text-sm text-zinc-400 border border-dashed border-zinc-600 rounded-lg hover:border-zinc-400 hover:text-zinc-200 transition-colors"
            >
              + Add Section
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
