import type { UserMessage as UserMessageType } from '@/types/agent'

interface UserMessageProps {
  message: UserMessageType
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.attachments.map((a) => (
              <span key={a.filePath} className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
                {a.fileName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
