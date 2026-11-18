'use client'

import { SubTabs, useView } from '@/components/marketing/SubTabs'
import SendLogView from '@/components/marketing/SendLogView'
import AnalyticsView from '@/components/marketing/AnalyticsView'

const VIEWS = ['log', 'analytics'] as const
type View = (typeof VIEWS)[number]

export default function ActivityPage() {
  const [view, setView] = useView<View>('log', VIEWS)
  return (
    <div>
      <div className="px-4 sm:px-6 pt-4 max-w-7xl mx-auto">
        <SubTabs<View>
          value={view}
          onChange={setView}
          tabs={[
            { id: 'log', label: 'Send log' },
            { id: 'analytics', label: 'Visitor analytics' },
          ]}
        />
      </div>
      {view === 'log' && <SendLogView />}
      {view === 'analytics' && <AnalyticsView />}
    </div>
  )
}
