#!/usr/bin/env python3
"""Create a platform admin user.

Usage (inside backend container):
    python /app/scripts/create_admin.py

Usage (via docker):
    docker exec -it ai_agent_api python /app/scripts/create_admin.py
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


def collect_input() -> tuple[str, str, str]:
    print()
    print('╔══════════════════════════════════════════╗')
    print('║     AGENA — Create Platform Admin        ║')
    print('╚══════════════════════════════════════════╝')
    print()

    # Email
    while True:
        email = input('  Email: ').strip()
        if EMAIL_PATTERN.match(email):
            break
        print('  ✗ Invalid email format. Try again.\n')

    # Full name
    name = input('  Full Name: ').strip()
    if not name:
        name = 'Platform Admin'

    # Password
    print()
    print('  Password rules:')
    print('    • Minimum 12 characters')
    print('    • At least 1 uppercase letter')
    print('    • At least 1 lowercase letter')
    print('    • At least 1 digit')
    print('    • At least 1 special character (!@#$%^&*...)')
    print()

    while True:
        password = getpass.getpass('  Password: ')
        if not PASSWORD_PATTERN.match(password):
            print('  ✗ Password does not meet requirements. Try again.\n')
            continue

        confirm = getpass.getpass('  Confirm Password: ')
        if password != confirm:
            print('  ✗ Passwords do not match. Try again.\n')
            continue

        break

    return email, password, name


async def create_admin(email: str, password: str, name: str) -> None:
    async with SessionLocal() as db:
        # Check if user already exists
        existing = await db.execute(select(User).where(User.email == email))
        user = existing.scalar_one_or_none()

        if user:
            user.is_platform_admin = True
            await db.commit()
            print(f'\n  ✓ Existing user "{email}" promoted to platform admin.\n')
            return

        # Get or create platform admin org
        org_result = await db.execute(select(Organization).where(Organization.slug == ADMIN_ORG_SLUG))
        org = org_result.scalar_one_or_none()
        if not org:
            org = Organization(name=ADMIN_ORG_NAME, slug=ADMIN_ORG_SLUG)
            db.add(org)
            await db.flush()
            db.add(Subscription(organization_id=org.id, plan_name='enterprise', status='active'))

        # Create admin user
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
        print('  ╔══════════════════════════════════════╗')
        print('  ║  ✓ Platform admin created!            ║')
        print('  ╚══════════════════════════════════════╝')
        print(f'  Email: {email}')
        print(f'  Name:  {name}')
        print(f'  Org:   {ADMIN_ORG_NAME}')
        print(f'  Login: https://agena.dev/signin')
        print()


def main() -> None:
    try:
        email, password, name = collect_input()
    except (KeyboardInterrupt, EOFError):
        print('\n\n  Cancelled.\n')
        sys.exit(0)

    asyncio.run(create_admin(email, password, name))


if __name__ == '__main__':
    main()
