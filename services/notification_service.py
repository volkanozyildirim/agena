from __future__ import annotations

import json
import logging
import smtplib
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.settings import get_settings
from models.user import User
from models.user_preference import UserPreference

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.settings = get_settings()

    async def notify_task_result(
        self,
        *,
        user_id: int,
        task_id: int,
        task_title: str,
        status: str,
        pr_url: str | None = None,
        failure_reason: str | None = None,
    ) -> bool:
        recipient = await self._resolve_recipient(user_id)
        if not recipient:
            return False

        subject = f"[Tiqr] Task #{task_id} {status.upper()}: {task_title}"
        if status == 'completed':
            body = (
                f"Task completed successfully.\n\n"
                f"Task: #{task_id} - {task_title}\n"
                f"Status: {status}\n"
                f"PR: {pr_url or '-'}\n"
            )
        else:
            body = (
                f"Task finished with status: {status}\n\n"
                f"Task: #{task_id} - {task_title}\n"
                f"Reason: {failure_reason or '-'}\n"
                f"PR: {pr_url or '-'}\n"
            )
        return self._send_email(recipient, subject, body)

    async def _resolve_recipient(self, user_id: int) -> str | None:
        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user is None or not user.email:
            return None

        pref_result = await self.db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
        pref = pref_result.scalar_one_or_none()
        if pref and pref.profile_settings_json:
            try:
                settings = json.loads(pref.profile_settings_json)
                if isinstance(settings, dict) and settings.get('email_notifications') is False:
                    return None
            except Exception:
                pass
        return user.email

    def _send_email(self, to_email: str, subject: str, body: str) -> bool:
        if not self.settings.smtp_host:
            logger.info('SMTP_HOST not configured, skipping email notification')
            return False

        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = f"{self.settings.smtp_from_name} <{self.settings.smtp_from_email}>"
        msg['To'] = to_email

        try:
            if self.settings.smtp_use_ssl:
                server = smtplib.SMTP_SSL(self.settings.smtp_host, self.settings.smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=10)

            with server:
                if self.settings.smtp_use_tls and not self.settings.smtp_use_ssl:
                    server.starttls()
                if self.settings.smtp_user:
                    server.login(self.settings.smtp_user, self.settings.smtp_password)
                server.sendmail(self.settings.smtp_from_email, [to_email], msg.as_string())
            return True
        except Exception:
            logger.exception('Failed to send email notification')
            return False
