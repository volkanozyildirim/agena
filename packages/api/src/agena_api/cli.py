"""AGENA CLI — Platform management commands.

Usage:
    agena admin:user:create    — Create a platform admin user (interactive)
    agena admin:user:list      — List all platform admins
    agena admin:user:promote   — Promote existing user to admin by email
"""
import asyncio
import getpass
import re
import sys

from sqlalchemy import select

from agena_core.database import SessionLocal
from agena_core.security.passwords import hash_password
from agena_models.models.organization import Organization
from agena_models.models.organization_member import OrganizationMember
from agena_models.models.subscription import Subscription
from agena_models.models.user import User

PASSWORD_PATTERN = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:,.<>?]).{12,}$'
)
EMAIL_PATTERN = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

ADMIN_ORG_NAME = 'AGENA Platform'
ADMIN_ORG_SLUG = 'agena-platform'


def _header() -> None:
    print()
    print('  ╔══════════════════════════════════════════╗')
    print('  ║           AGENA Platform CLI              ║')
    print('  ╚══════════════════════════════════════════╝')
    print()


def _collect_user_input() -> tuple[str, str, str]:
    # Email
    while True:
        email = input('  Email: ').strip()
        if EMAIL_PATTERN.match(email):
            break
        print('  ✗ Invalid email format.\n')

    # Full name
    name = input('  Full Name: ').strip() or 'Platform Admin'

    # Password
    print()
    print('  Password rules:')
    print('    • Minimum 12 characters')
    print('    • At least 1 uppercase (A-Z)')
    print('    • At least 1 lowercase (a-z)')
    print('    • At least 1 digit (0-9)')
    print('    • At least 1 special char (!@#$%^&*...)')
    print()

    while True:
        password = getpass.getpass('  Password: ')
        if not PASSWORD_PATTERN.match(password):
            print('  ✗ Password does not meet requirements.\n')
            continue
        confirm = getpass.getpass('  Confirm Password: ')
        if password != confirm:
            print('  ✗ Passwords do not match.\n')
            continue
        break

    return email, password, name


async def _ensure_admin_org(db) -> Organization:  # noqa: ANN001
    result = await db.execute(select(Organization).where(Organization.slug == ADMIN_ORG_SLUG))
    org = result.scalar_one_or_none()
    if not org:
        org = Organization(name=ADMIN_ORG_NAME, slug=ADMIN_ORG_SLUG)
        db.add(org)
        await db.flush()
        db.add(Subscription(organization_id=org.id, plan_name='enterprise', status='active'))
    return org


async def cmd_create() -> None:
    _header()
    print('  Create Platform Admin')
    print('  ─────────────────────')
    print()

    try:
        email, password, name = _collect_user_input()
    except (KeyboardInterrupt, EOFError):
        print('\n\n  Cancelled.\n')
        return

    async with SessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            print(f'\n  ✗ User "{email}" already exists. Use `agena admin:user:promote` instead.\n')
            return

        org = await _ensure_admin_org(db)

        user = User(
            email=email,
            full_name=name,
            hashed_password=hash_password(password),
            is_platform_admin=True,
        )
        db.add(user)
        await db.flush()
        db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role='owner'))
        await db.commit()

    print()
    print('  ✓ Platform admin created!')
    print(f'    Email : {email}')
    print(f'    Name  : {name}')
    print(f'    Org   : {ADMIN_ORG_NAME}')
    print(f'    Login : https://agena.dev/signin')
    print()


async def cmd_list() -> None:
    _header()
    print('  Platform Admins')
    print('  ───────────────')
    print()

    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.is_platform_admin == True))  # noqa: E712
        admins = result.scalars().all()

        if not admins:
            print('  No platform admins found.\n')
            return

        for u in admins:
            status = '●' if u.is_active else '○'
            print(f'  {status} {u.email}  ({u.full_name})  ID={u.id}')

    print(f'\n  Total: {len(admins)}\n')


async def cmd_promote() -> None:
    _header()
    print('  Promote User to Platform Admin')
    print('  ──────────────────────────────')
    print()

    try:
        email = input('  Email of existing user: ').strip()
    except (KeyboardInterrupt, EOFError):
        print('\n\n  Cancelled.\n')
        return

    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            print(f'\n  ✗ User "{email}" not found.\n')
            return

        if user.is_platform_admin:
            print(f'\n  ✗ User "{email}" is already a platform admin.\n')
            return

        user.is_platform_admin = True
        await db.commit()

    print(f'\n  ✓ "{email}" is now a platform admin.\n')


COMMANDS = {
    'admin:user:create': cmd_create,
    'admin:user:list': cmd_list,
    'admin:user:promote': cmd_promote,
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help', 'help'):
        _header()
        print('  Usage: agena <command>\n')
        print('  Commands:')
        print('    admin:user:create   — Create a new platform admin (interactive)')
        print('    admin:user:list     — List all platform admins')
        print('    admin:user:promote  — Promote existing user to admin')
        print()
        return

    cmd_name = sys.argv[1]
    cmd_fn = COMMANDS.get(cmd_name)

    if not cmd_fn:
        print(f'\n  ✗ Unknown command: {cmd_name}')
        print(f'  Run `agena help` for available commands.\n')
        sys.exit(1)

    asyncio.run(cmd_fn())


if __name__ == '__main__':
    main()
