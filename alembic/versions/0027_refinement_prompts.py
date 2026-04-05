"""seed refinement prompts into prompts table

Revision ID: 0027_refinement_prompts
Revises: 0026_task_repo_assignments
Create Date: 2026-04-05
"""

from alembic import op
import sqlalchemy as sa

revision = '0027_refinement_prompts'
down_revision = '0026_task_repo_assignments'
branch_labels = None
depends_on = None

REFINEMENT_SYSTEM = (
    'You are performing sprint refinement for an engineering team.\n'
    'Follow the requested output language exactly for all natural-language fields.\n'
    'Use only the provided work item content.\n'
    'Do not assume implementation details that are not present.\n'
    'If information is missing, lower confidence and list explicit ambiguities and follow-up questions.\n'
    'The "comment" field must be a direct actionable statement, not a question sentence.\n'
    'Put all questions only in the "questions" array.\n'
    'Suggested story points must be chosen only from this Fibonacci scale: {point_scale}.\n'
    'Return valid JSON only.'
)

REFINEMENT_DESC = (
    'Provider: {provider}\n'
    'Sprint: {sprint_name}\n'
    'Requested output language: {language}\n'
    'Point scale: {point_scale}\n\n'
    'Work item ID: {item_id}\n'
    'Work item type: {work_item_type}\n'
    'Title: {title}\n'
    'Current state: {state}\n'
    'Current story points: {current_story_points}\n'
    'Current effort: {current_effort}\n'
    'Assigned to: {assigned_to}\n\n'
    'Description:\n{description}'
)

REFINEMENT_EXPECTED = (
    'Return a JSON object with these keys:\n'
    '- summary: short delivery-oriented summary in {language}\n'
    '- suggested_story_points: integer from {point_scale}, or 0 if the item is too ambiguous to estimate\n'
    '- estimation_rationale: concise explanation in {language} describing why this score fits the item\n'
    '- confidence: integer from 0 to 100\n'
    '- comment: a refinement comment in {language} ready to paste into the work item\n'
    '- ambiguities: array of missing details that block precise estimation\n'
    '- questions: array of concrete follow-up questions for product or engineering\n'
    '- ready_for_planning: boolean'
)


def upgrade() -> None:
    prompts_table = sa.table(
        'prompts',
        sa.column('slug', sa.String),
        sa.column('name', sa.String),
        sa.column('category', sa.String),
        sa.column('content', sa.Text),
        sa.column('description', sa.String),
        sa.column('is_active', sa.Boolean),
        sa.column('version', sa.Integer),
    )

    seeds = [
        {
            'slug': 'refinement_system_prompt',
            'name': 'Sprint Refinement System Prompt',
            'category': 'refinement',
            'content': REFINEMENT_SYSTEM,
            'description': 'System instructions for the refinement analyst agent',
            'is_active': True,
            'version': 1,
        },
        {
            'slug': 'refinement_description_prompt',
            'name': 'Sprint Refinement Description Prompt',
            'category': 'refinement',
            'content': REFINEMENT_DESC,
            'description': 'User prompt template with work item variables for refinement',
            'is_active': True,
            'version': 1,
        },
        {
            'slug': 'refinement_expected_output',
            'name': 'Sprint Refinement Expected Output',
            'category': 'refinement',
            'content': REFINEMENT_EXPECTED,
            'description': 'Expected output format for refinement JSON response',
            'is_active': True,
            'version': 1,
        },
    ]

    bind = op.get_bind()
    for seed in seeds:
        existing = bind.execute(
            sa.text("SELECT id FROM prompts WHERE slug = :slug"),
            {'slug': seed['slug']},
        ).fetchone()
        if not existing:
            op.execute(prompts_table.insert().values(**seed))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM prompts WHERE slug IN ('refinement_system_prompt', 'refinement_description_prompt', 'refinement_expected_output')"))
