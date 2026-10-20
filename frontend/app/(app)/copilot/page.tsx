import { CopilotChat } from '@/components/copilot/copilot-chat'
import { PageHeader } from '@/components/ui/primitives'

export default function CopilotPage() {
  return (
    <>
      <PageHeader
        title="AI copilot"
        description="Ask in plain language. Answers are grounded in tool calls to the analytics engine and cite source records."
        showFilters={false}
      />
      <CopilotChat />
    </>
  )
}
