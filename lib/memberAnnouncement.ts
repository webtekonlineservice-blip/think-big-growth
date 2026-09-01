/**
 * Member Announcement Email — showcases the Think Big Growth platform with live data.
 */

const APP_URL = 'https://thinkbig.webtek.ai'

interface MemberEmailParams {
  memberName: string
  inviteCode: string
  stats?: {
    members: number
    prospects: number
    emailsSent: number
    openCategories: number
  }
}

export function buildMemberAnnouncement({ memberName, inviteCode, stats }: MemberEmailParams): string {
  const firstName = memberName.split(' ')[0]
  const inviteUrl = `${APP_URL}/invite/${inviteCode}`

  const feature = (icon: string, title: string, desc: string) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #1f2937;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="52" valign="top">
            <div style="width:40px;height:40px;background:#CC0000;border-radius:10px;text-align:center;line-height:40px;font-size:20px;">${icon}</div>
          </td>
          <td valign="top" style="padding-left:4px;">
            <p style="margin:0 0 3px;font-size:15px;font-weight:700;color:#f1f5f9;">${title}</p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">${desc}</p>
          </td>
        </tr></table>
      </td>
    </tr>`

  const statCard = (value: string | number, label: string, color: string) => `
    <td width="25%" align="center" style="padding:6px;">
      <div style="background:#0a0f1e;border:1px solid #1f2937;border-radius:10px;padding:16px 6px;">
        <p style="margin:0;font-size:26px;font-weight:800;color:${color};line-height:1;">${value}</p>
        <p style="margin:6px 0 0;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;">${label}</p>
      </div>
    </td>`

  const statsBlock = stats ? `
  <tr><td style="background:#111827;padding:8px 32px 24px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#818cf8;">📊 Live Chapter Data — Right Now</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${statCard(stats.members, 'Members', '#ffffff')}
      ${statCard(stats.prospects, 'Prospects', '#CC0000')}
      ${statCard(stats.emailsSent, 'Emails Sent', '#4F46E5')}
      ${statCard(stats.openCategories, 'Open Seats', '#22c55e')}
    </tr></table>
    <p style="margin:14px 0 0;font-size:12px;color:#64748b;text-align:center;font-style:italic;">
      Real data from the platform — updating live as the chapter grows.
    </p>
  </td></tr>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Red accent bar -->
  <tr><td style="background:linear-gradient(135deg,#CC0000,#990000);border-radius:14px 14px 0 0;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- Hero -->
  <tr><td style="background:#111827;padding:40px 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <span style="display:inline-block;background:#CC0000;color:#fff;font-weight:800;font-size:13px;padding:6px 12px;border-radius:7px;letter-spacing:.5px;">BNI</span>
        <span style="margin-left:10px;font-weight:700;font-size:17px;color:#f1f5f9;vertical-align:middle;">Think Big St. Louis</span>
      </td>
    </tr></table>

    <h1 style="margin:28px 0 12px;font-size:30px;font-weight:800;line-height:1.2;color:#ffffff;">
      Hey ${firstName} — meet your<br/><span style="color:#CC0000;">chapter growth engine.</span>
    </h1>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#cbd5e1;">
      We built a platform to grow Think Big St. Louis on autopilot — finding local businesses,
      inviting them to visit, and tracking every referral back to the member who brought them in.
      Here's what it's already doing.
    </p>
  </td></tr>

  ${statsBlock}

  <!-- Features -->
  <tr><td style="background:#111827;padding:8px 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${feature('🔗', 'Your Personal Invite Link', 'Share one link — every visitor who registers is automatically credited to you. No paperwork.')}
      ${feature('🎯', 'Open-Seat Targeting', 'We find local businesses in professions our chapter still needs and invite them for you.')}
      ${feature('🤖', 'Automated Follow-Ups', 'The system emails and texts prospects on the right days so nobody falls through the cracks.')}
      ${feature('📈', 'Live Pipeline & Analytics', 'Watch prospects move from invited → visited → member, with conversion rates and top inviters.')}
    </table>
  </td></tr>

  <!-- Invite link callout -->
  <tr><td style="background:#111827;padding:8px 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(204,0,0,0.12),rgba(79,70,229,0.08));border:1px solid rgba(204,0,0,0.3);border-radius:12px;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f87171;">Your Personal Invite Link</p>
        <p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;line-height:1.5;">Share this anywhere. Every signup is credited to you:</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#0a0f1e;border:1px solid #334155;border-radius:8px;padding:12px 16px;">
            <a href="${inviteUrl}" style="color:#818cf8;font-size:14px;text-decoration:none;word-break:break-all;">${inviteUrl.replace('https://', '')}</a>
          </td>
        </tr></table>
        <div style="margin-top:20px;">
          <a href="${inviteUrl}" style="display:inline-block;background:#CC0000;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Preview Your Invite Page →</a>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Login CTA -->
  <tr><td style="background:#111827;padding:0 40px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1f2937;">
      <tr><td style="padding-top:28px;text-align:center;">
        <p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;">Log in to your dashboard to see your visitors and stats.</p>
        <a href="${APP_URL}/member/login" style="display:inline-block;background:#4F46E5;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Log In to Your Dashboard →</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0d1117;border-radius:0 0 14px 14px;padding:24px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
          <strong style="color:#94a3b8;">Think Big St. Louis</strong> · BNI Chapter<br/>
          Every Thursday 11:30 AM · Mike Duffy's Pub &amp; Grill, Kirkwood MO
        </p>
      </td>
      <td align="right" valign="bottom">
        <span style="font-size:11px;color:#475569;">Built by </span>
        <a href="https://webtek.ai" style="color:#4F46E5;text-decoration:none;font-size:12px;font-weight:700;">Webtek.ai</a>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
