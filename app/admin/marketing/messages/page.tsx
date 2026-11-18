'use client'

import { SubTabs, useView } from '@/components/marketing/SubTabs'
import CampaignsView from '@/components/marketing/CampaignsView'
import BillingView from '@/components/marketing/BillingView'
import MemberEmailView from '@/components/marketing/MemberEmailView'
import EmailTestView from '@/components/marketing/EmailTestView'

const VIEWS = ['send', 'billing', 'member-email', 'test'] as const
type View = (typeof VIEWS)[number]

export default function MessagesPage() {
  const [view, setView] = useView<View>('send', VIEWS)
  return (
    <div>
      <div className="px-4 sm:px-6 pt-4 max-w-7xl mx-auto">
        <SubTabs<View>
          value={view}
          onChange={setView}
          tabs={[
            { id: 'send', label: 'Segments & Quick Send' },
            { id: 'billing', label: 'Invoices & Reminders' },
            { id: 'member-email', label: 'Member Email' },
            { id: 'test', label: 'Email Test' },
          ]}
        />
      </div>
      {view === 'send' && <CampaignsView />}
      {view === 'billing' && <BillingView />}
      {view === 'member-email' && <MemberEmailView />}
      {view === 'test' && <EmailTestView />}
    </div>
  )
}
