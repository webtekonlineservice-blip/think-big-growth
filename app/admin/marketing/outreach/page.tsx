'use client'

import { SubTabs, useView } from '@/components/marketing/SubTabs'
import LeadEngineView from '@/components/marketing/LeadEngineView'
import OutboundView from '@/components/marketing/OutboundView'

const VIEWS = ['leads', 'campaigns'] as const
type View = (typeof VIEWS)[number]

export default function OutreachPage() {
  const [view, setView] = useView<View>('leads', VIEWS)
  return (
    <div>
      <div className="px-4 sm:px-6 pt-4 max-w-7xl mx-auto">
        <SubTabs<View>
          value={view}
          onChange={setView}
          tabs={[
            { id: 'leads', label: 'Find leads' },
            { id: 'campaigns', label: 'Email campaigns' },
          ]}
        />
      </div>
      {view === 'leads' && <LeadEngineView />}
      {view === 'campaigns' && <OutboundView />}
    </div>
  )
}
