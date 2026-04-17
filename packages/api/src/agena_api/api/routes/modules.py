"""Module management — list available modules and toggle per organization."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_api.api.dependencies import CurrentTenant, get_current_tenant, require_permission
from agena_core.database import get_db_session
from agena_models.models.module import Module, OrganizationModule

router = APIRouter(prefix='/modules', tags=['modules'])


class ModuleItem(BaseModel):
    slug: str
    name: str
    description: str | None = None
    icon: str = '📦'
    is_core: bool = False
    default_enabled: bool = True
    enabled: bool = True


class ModuleToggleRequest(BaseModel):
    enabled: bool


@router.get('', response_model=list[ModuleItem])
async def list_modules(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> list[ModuleItem]:
    modules = list((await db.execute(
        select(Module).order_by(Module.sort_order)
    )).scalars().all())

    org_overrides = {}
    rows = (await db.execute(
        select(OrganizationModule).where(
            OrganizationModule.organization_id == tenant.organization_id,
        )
    )).scalars().all()
    for row in rows:
        org_overrides[row.module_slug] = row.enabled

    result = []
    for m in modules:
        enabled = m.is_core or org_overrides.get(m.slug, m.default_enabled)
        result.append(ModuleItem(
            slug=m.slug,
            name=m.name,
            description=m.description,
            icon=m.icon,
            is_core=m.is_core,
            default_enabled=m.default_enabled,
            enabled=enabled,
        ))
    return result


@router.put('/{slug}', response_model=ModuleItem)
async def toggle_module(
    slug: str,
    request: ModuleToggleRequest,
    tenant: CurrentTenant = Depends(require_permission('integrations:manage')),
    db: AsyncSession = Depends(get_db_session),
) -> ModuleItem:
    module = (await db.execute(
        select(Module).where(Module.slug == slug)
    )).scalar_one_or_none()
    if module is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail='Module not found')
    if module.is_core:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail='Core modules cannot be disabled')

    existing = (await db.execute(
        select(OrganizationModule).where(
            OrganizationModule.organization_id == tenant.organization_id,
            OrganizationModule.module_slug == slug,
        )
    )).scalar_one_or_none()

    if existing:
        existing.enabled = request.enabled
    else:
        db.add(OrganizationModule(
            organization_id=tenant.organization_id,
            module_slug=slug,
            enabled=request.enabled,
        ))
    await db.commit()

    return ModuleItem(
        slug=module.slug,
        name=module.name,
        description=module.description,
        icon=module.icon,
        is_core=module.is_core,
        default_enabled=module.default_enabled,
        enabled=request.enabled,
    )
