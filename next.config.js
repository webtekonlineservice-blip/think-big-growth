/** @type {import('next').NextConfig} */

// Old admin URLs → their new home. Temporary (307) so they can be changed later.
const moved = [
  ['/admin/growth', '/admin/marketing/advisor'],
  ['/admin/lead-engine', '/admin/marketing/outreach?view=leads'],
  ['/admin/outbound', '/admin/marketing/outreach?view=campaigns'],
  ['/admin/prospects', '/admin/marketing/outreach?view=campaigns'],
  ['/admin/campaigns', '/admin/marketing/messages?view=send'],
  ['/admin/announce', '/admin/marketing/messages?view=member-email'],
  ['/admin/email-test', '/admin/marketing/messages?view=test'],
  ['/admin/send-log', '/admin/marketing/activity?view=log'],
  ['/admin/analytics', '/admin/marketing/activity?view=analytics'],
  ['/admin/seats', '/admin/members/seats'],
]

const nextConfig = {
  async redirects() {
    return moved.map(([source, destination]) => ({ source, destination, permanent: false }))
  },
}
module.exports = nextConfig
