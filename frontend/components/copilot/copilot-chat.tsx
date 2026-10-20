'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import clsx from 'clsx'
import { ArrowUp, Loader2, Wrench } from 'lucide-react'

const SUGGESTIONS = [
  'Why is Site A underperforming this month?',
  'Which equipment should maintenance look at first, and why?',
  'Simulate a 15% truck queue reduction at Site B',
  'Where are we losing the most money to Lean waste?',
  'What can Site A learn from the best-performing site?',
]

const TOOL_LABEL: Record<string, string> = {
  getOverview: 'Reading KPIs',
  getRisk: 'Scoring equipment risk',
  getLeanWaste: 'Analysing Lean waste',
  compareSites: 'Comparing sites',
  runSimulation: 'Running simulation',
  getRecommendations: 'Ranking recommendations',
  searchKnowledge: 'Searching knowledge base',
}

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    const bullet = /^\s*[-*]\s+/.test(line)
    const clean = line.replace(/^\s*[-*]\s+/, '').replace(/^#+\s*/, '')
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>,
    )
    if (!clean.trim()) return <div key={i} className="h-2" />
    return bullet ? (
      <p key={i} className="flex gap-2 pl-1">
        <span aria-hidden className="text-muted-foreground">•</span>
        <span>{parts}</span>
      </p>
    ) : (
      <p key={i}>{parts}</p>
    )
  })
}

export function CopilotChat() {
  const { messages, sendMessage, status, error } = useChat()
  const [input, setInput] = useState('')
  const busy = status === 'submitted' || status === 'streaming'

  const submit = (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    sendMessage({ text: t })
    setInput('')
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[480px] flex-col lg:h-[calc(100vh-7.5rem)]">
      <div className="flex-1 overflow-y-auto px-6 py-6" aria-live="polite">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 && (
            <div className="flex flex-col gap-4 py-8">
              <p className="text-sm text-muted-foreground">
                The copilot answers using the same analytics engines as the dashboard, via tools. It cites record IDs so every answer can be audited.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="card p-3 text-left text-sm transition-colors hover:border-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={clsx('flex flex-col gap-2', m.role === 'user' && 'items-end')}>
              {m.parts.map((part, i) => {
                if (part.type === 'text') {
                  return m.role === 'user' ? (
                    <p key={i} className="max-w-[85%] rounded-lg bg-foreground px-3.5 py-2 text-sm text-background">
                      {part.text}
                    </p>
                  ) : (
                    <div key={i} className="flex flex-col gap-1 text-sm leading-relaxed">
                      {renderText(part.text)}
                    </div>
                  )
                }
                if (part.type.startsWith('tool-')) {
                  const name = part.type.slice(5)
                  const done = 'state' in part && part.state === 'output-available'
                  return (
                    <span key={i} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                      {done ? <Wrench className="size-3" aria-hidden /> : <Loader2 className="size-3 animate-spin" aria-hidden />}
                      {TOOL_LABEL[name] ?? name}
                    </span>
                  )
                }
                return null
              })}
            </div>
          ))}
          {status === 'submitted' && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Thinking…
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-md border border-risk-critical/30 bg-risk-critical/5 px-3 py-2 text-sm text-risk-critical">
              {error.message || 'Something went wrong. Please try again.'}
            </p>
          )}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
        className="border-t border-border bg-surface px-6 py-4"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label htmlFor="copilot-input" className="sr-only">
            Ask the copilot
          </label>
          <textarea
            id="copilot-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                e.preventDefault()
                submit(input)
              }
            }}
            placeholder="Ask about risk, waste, sites or scenarios…"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-muted-foreground">
          Decision support only. Synthetic data. Safety-relevant actions require human approval.
        </p>
      </form>
    </div>
  )
}
