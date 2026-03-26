from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import case, cast, Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.task_record import TaskRecord


class DoraService:
    """Calculates the four DORA metrics from TaskRecord data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def overview(self, organization_id: int, days: int = 30) -> dict:
        since = datetime.utcnow() - timedelta(days=days)

        # ── Daily breakdown ────────────────────────────────────────────────
        day_col = cast(TaskRecord.updated_at, Date).label('day')

        daily_result = await self.db.execute(
            select(
                day_col,
                func.sum(case((TaskRecord.status == 'completed', 1), else_=0)).label('completed'),
                func.sum(case((TaskRecord.status == 'failed', 1), else_=0)).label('failed'),
            )
            .where(
                TaskRecord.organization_id == organization_id,
                TaskRecord.updated_at >= since,
            )
            .group_by(day_col)
            .order_by(day_col)
        )
        daily_rows = daily_result.all()

        # ── Lead Time: avg hours from created_at to updated_at for completed tasks ──
        lt_result = await self.db.execute(
            select(
                func.avg(
                    func.extract('epoch', TaskRecord.updated_at) -
                    func.extract('epoch', TaskRecord.created_at)
                ).label('avg_seconds'),
            )
            .where(
                TaskRecord.organization_id == organization_id,
                TaskRecord.status == 'completed',
                TaskRecord.updated_at >= since,
            )
        )
        lt_row = lt_result.one()
        avg_lead_time_seconds = float(lt_row.avg_seconds) if lt_row.avg_seconds else None
        lead_time_hours = round(avg_lead_time_seconds / 3600, 2) if avg_lead_time_seconds else None

        # ── Daily lead time for sparkline ──────────────────────────────────
        daily_lt_result = await self.db.execute(
            select(
                day_col,
                func.avg(
                    func.extract('epoch', TaskRecord.updated_at) -
                    func.extract('epoch', TaskRecord.created_at)
                ).label('avg_seconds'),
            )
            .where(
                TaskRecord.organization_id == organization_id,
                TaskRecord.status == 'completed',
                TaskRecord.updated_at >= since,
            )
            .group_by(day_col)
            .order_by(day_col)
        )
        daily_lt_map: dict[str, float | None] = {}
        for row in daily_lt_result.all():
            val = float(row.avg_seconds) / 3600 if row.avg_seconds else None
            daily_lt_map[str(row.day)] = round(val, 2) if val else None

        # ── Deployment Frequency: completed tasks per day ──────────────────
        total_completed_result = await self.db.execute(
            select(func.count(TaskRecord.id))
            .where(
                TaskRecord.organization_id == organization_id,
                TaskRecord.status == 'completed',
                TaskRecord.updated_at >= since,
            )
        )
        total_completed = total_completed_result.scalar() or 0
        deploy_frequency = round(total_completed / max(days, 1), 2) if total_completed else None

        # ── Change Failure Rate ────────────────────────────────────────────
        total_settled_result = await self.db.execute(
            select(
                func.sum(case((TaskRecord.status == 'completed', 1), else_=0)).label('completed'),
                func.sum(case((TaskRecord.status == 'failed', 1), else_=0)).label('failed'),
            )
            .where(
                TaskRecord.organization_id == organization_id,
                TaskRecord.updated_at >= since,
                TaskRecord.status.in_(['completed', 'failed']),
            )
        )
        settled = total_settled_result.one()
        completed_count = int(settled.completed or 0)
        failed_count = int(settled.failed or 0)
        total_settled = completed_count + failed_count
        change_failure_rate = round((failed_count / total_settled) * 100, 2) if total_settled > 0 else None

        # ── MTTR: avg hours for failed tasks from failure to next completion ──
        # Approximation: avg time between a failed task's updated_at and the
        # next completed task's updated_at for the same org.
        # Simpler proxy: avg duration of failed tasks (created -> updated).
        mttr_result = await self.db.execute(
            select(
                func.avg(
                    func.extract('epoch', TaskRecord.updated_at) -
                    func.extract('epoch', TaskRecord.created_at)
                ).label('avg_seconds'),
            )
            .where(
                TaskRecord.organization_id == organization_id,
                TaskRecord.status == 'failed',
                TaskRecord.updated_at >= since,
            )
        )
        mttr_row = mttr_result.one()
        avg_mttr_seconds = float(mttr_row.avg_seconds) if mttr_row.avg_seconds else None
        mttr_hours = round(avg_mttr_seconds / 3600, 2) if avg_mttr_seconds else None

        # ── Daily MTTR for sparkline ───────────────────────────────────────
        daily_mttr_result = await self.db.execute(
            select(
                day_col,
                func.avg(
                    func.extract('epoch', TaskRecord.updated_at) -
                    func.extract('epoch', TaskRecord.created_at)
                ).label('avg_seconds'),
            )
            .where(
                TaskRecord.organization_id == organization_id,
                TaskRecord.status == 'failed',
                TaskRecord.updated_at >= since,
            )
            .group_by(day_col)
            .order_by(day_col)
        )
        daily_mttr_map: dict[str, float | None] = {}
        for row in daily_mttr_result.all():
            val = float(row.avg_seconds) / 3600 if row.avg_seconds else None
            daily_mttr_map[str(row.day)] = round(val, 2) if val else None

        # ── Assemble daily array ───────────────────────────────────────────
        daily = []
        for row in daily_rows:
            d = str(row.day)
            daily.append({
                'date': d,
                'completed': int(row.completed or 0),
                'failed': int(row.failed or 0),
                'lead_time_hours': daily_lt_map.get(d),
                'mttr_hours': daily_mttr_map.get(d),
            })

        return {
            'lead_time_hours': lead_time_hours,
            'deploy_frequency': deploy_frequency,
            'change_failure_rate': change_failure_rate,
            'mttr_hours': mttr_hours,
            'daily': daily,
        }
