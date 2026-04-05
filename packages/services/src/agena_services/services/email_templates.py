"""HTML email templates for AGENA notification emails."""

from __future__ import annotations


def _base_template(title: str, body_html: str, footer_text: str = '') -> str:
    """Wrap content in the AGENA branded email template."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:16px;border:1px solid #1e293b;overflow:hidden">
  <!-- Header -->
  <tr>
    <td style="padding:28px 32px 20px;border-bottom:1px solid #1e293b">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:20px;font-weight:800;color:#f1f5f9;letter-spacing:-0.3px">
            AGENA
          </td>
          <td align="right" style="font-size:12px;color:#64748b">
            AI Agent Platform
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:32px">
      {body_html}
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 32px;border-top:1px solid #1e293b;background:#0d1117">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:#475569;line-height:1.5">
            {footer_text or 'You received this because of your notification settings.'}
            <br/>Manage preferences at
            <a href="https://agena.dev/dashboard/notifications" style="color:#0d9488;text-decoration:none">agena.dev/dashboard</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _severity_badge(severity: str) -> str:
    colors = {
        'success': ('#065f46', '#10b981', '#d1fae5'),
        'error': ('#7f1d1d', '#ef4444', '#fee2e2'),
        'warning': ('#78350f', '#f59e0b', '#fef3c7'),
        'info': ('#0c4a6e', '#38bdf8', '#e0f2fe'),
    }
    bg, border, text = colors.get(severity, colors['info'])
    label = severity.capitalize()
    return (
        f'<span style="display:inline-block;padding:4px 12px;border-radius:6px;'
        f'font-size:12px;font-weight:700;background:{bg};color:{text};'
        f'border:1px solid {border}">{label}</span>'
    )


def task_completed_email(
    *,
    task_id: int,
    task_title: str,
    pr_url: str | None = None,
    branch_name: str | None = None,
) -> tuple[str, str]:
    """Return (subject, html_body) for a task completion email."""
    subject = f'[AGENA] Task #{task_id} Completed: {task_title}'
    pr_row = ''
    if pr_url:
        pr_row = f"""\
        <tr>
          <td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b">Pull Request</td>
          <td style="padding:10px 16px;border-bottom:1px solid #1e293b">
            <a href="{pr_url}" style="color:#0d9488;font-size:13px;font-weight:600;text-decoration:none">{pr_url}</a>
          </td>
        </tr>"""
    branch_row = ''
    if branch_name:
        branch_row = f"""\
        <tr>
          <td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b">Branch</td>
          <td style="padding:10px 16px;font-size:13px;color:#e2e8f0;border-bottom:1px solid #1e293b">
            <code style="background:#1e293b;padding:2px 8px;border-radius:4px;font-size:12px">{branch_name}</code>
          </td>
        </tr>"""

    body = f"""\
      {_severity_badge('success')}
      <h2 style="color:#f1f5f9;font-size:18px;font-weight:700;margin:16px 0 8px">
        Task #{task_id} Completed
      </h2>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6">{task_title}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;border-radius:10px;border:1px solid #1e293b;overflow:hidden">
        <tr>
          <td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b">Status</td>
          <td style="padding:10px 16px;font-size:13px;color:#10b981;font-weight:600;border-bottom:1px solid #1e293b">Completed</td>
        </tr>
        {pr_row}
        {branch_row}
      </table>
      <div style="margin-top:28px;text-align:center">
        <a href="https://agena.dev/dashboard/tasks"
           style="display:inline-block;padding:12px 28px;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">
          View Task Details
        </a>
      </div>"""
    return subject, _base_template(subject, body)


def task_failed_email(
    *,
    task_id: int,
    task_title: str,
    failure_reason: str | None = None,
) -> tuple[str, str]:
    """Return (subject, html_body) for a task failure email."""
    subject = f'[AGENA] Task #{task_id} Failed: {task_title}'
    reason_row = ''
    if failure_reason:
        safe_reason = failure_reason.replace('<', '&lt;').replace('>', '&gt;')
        reason_row = f"""\
        <tr>
          <td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b">Reason</td>
          <td style="padding:10px 16px;font-size:13px;color:#fca5a5;border-bottom:1px solid #1e293b">{safe_reason}</td>
        </tr>"""

    body = f"""\
      {_severity_badge('error')}
      <h2 style="color:#f1f5f9;font-size:18px;font-weight:700;margin:16px 0 8px">
        Task #{task_id} Failed
      </h2>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6">{task_title}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;border-radius:10px;border:1px solid #1e293b;overflow:hidden">
        <tr>
          <td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b">Status</td>
          <td style="padding:10px 16px;font-size:13px;color:#ef4444;font-weight:600;border-bottom:1px solid #1e293b">Failed</td>
        </tr>
        {reason_row}
      </table>
      <div style="margin-top:28px;text-align:center">
        <a href="https://agena.dev/dashboard/tasks"
           style="display:inline-block;padding:12px 28px;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">
          View Task Details
        </a>
      </div>"""
    return subject, _base_template(subject, body)


def pr_created_email(
    *,
    task_id: int,
    task_title: str,
    pr_url: str,
    branch_name: str | None = None,
) -> tuple[str, str]:
    """Return (subject, html_body) for a PR creation email."""
    subject = f'[AGENA] PR Created for Task #{task_id}: {task_title}'
    body = f"""\
      {_severity_badge('success')}
      <h2 style="color:#f1f5f9;font-size:18px;font-weight:700;margin:16px 0 8px">
        Pull Request Created
      </h2>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6">
        AI agents have finished working on <strong style="color:#e2e8f0">#{task_id} {task_title}</strong>
        and created a pull request for your review.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;border-radius:10px;border:1px solid #1e293b;overflow:hidden">
        <tr>
          <td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b">PR</td>
          <td style="padding:10px 16px;border-bottom:1px solid #1e293b">
            <a href="{pr_url}" style="color:#0d9488;font-size:13px;font-weight:600;text-decoration:none">{pr_url}</a>
          </td>
        </tr>
        {'<tr><td style="padding:10px 16px;color:#94a3b8;font-size:13px">Branch</td><td style="padding:10px 16px;font-size:13px;color:#e2e8f0"><code style="background:#1e293b;padding:2px 8px;border-radius:4px;font-size:12px">' + branch_name + '</code></td></tr>' if branch_name else ''}
      </table>
      <div style="margin-top:28px;text-align:center">
        <a href="{pr_url}"
           style="display:inline-block;padding:12px 28px;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">
          Review Pull Request
        </a>
      </div>"""
    return subject, _base_template(subject, body)


def generic_notification_email(
    *,
    title: str,
    message: str,
    severity: str = 'info',
    action_url: str | None = None,
    action_label: str = 'View Details',
) -> tuple[str, str]:
    """Return (subject, html_body) for a generic notification email."""
    subject = f'[AGENA] {title}'
    safe_message = message.replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')
    action_html = ''
    if action_url:
        action_html = f"""\
      <div style="margin-top:28px;text-align:center">
        <a href="{action_url}"
           style="display:inline-block;padding:12px 28px;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">
          {action_label}
        </a>
      </div>"""
    body = f"""\
      {_severity_badge(severity)}
      <h2 style="color:#f1f5f9;font-size:18px;font-weight:700;margin:16px 0 8px">{title}</h2>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6">{safe_message}</p>
      {action_html}"""
    return subject, _base_template(subject, body)
