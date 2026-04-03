'use client';

import Link from 'next/link';
import { useState } from 'react';

const SITE = 'https://agena.dev';

const sections = [
  {
    id: 'getting-started',
    icon: '🚀',
    title: 'Getting Started',
    children: [
      { id: 'overview', title: 'Platform Overview' },
      { id: 'signup', title: 'Sign Up & First Login' },
      { id: 'quickstart-saas', title: 'Quick Start (SaaS)' },
      { id: 'quickstart-selfhost', title: 'Quick Start (Self-Hosted)' },
    ],
  },
  {
    id: 'dashboard',
    icon: '🖥️',
    title: 'Dashboard Guide',
    children: [
      { id: 'office', title: 'Office (Pixel Agent Workspace)' },
      { id: 'tasks', title: 'Tasks' },
      { id: 'sprints', title: 'Sprint Board' },
      { id: 'sprint-performance', title: 'Sprint Performance' },
      { id: 'refinement', title: 'Refinement' },
      { id: 'agents', title: 'AI Agents' },
      { id: 'prompt-studio', title: 'Prompt Studio' },
      { id: 'flows', title: 'Flow Builder' },
      { id: 'templates', title: 'Templates' },
      { id: 'dora', title: 'DORA Metrics' },
    ],
  },
  {
    id: 'setup',
    icon: '⚙️',
    title: 'Configuration',
    children: [
      { id: 'integrations', title: 'Integrations Setup' },
      { id: 'repo-mapping', title: 'Repository Mapping' },
      { id: 'team-management', title: 'Team & Permissions' },
      { id: 'profile-settings', title: 'Profile & Preferences' },
      { id: 'chatops', title: 'ChatOps (Teams / Slack / Telegram)' },
    ],
  },
  {
    id: 'architecture',
    icon: '🏗️',
    title: 'Architecture',
    children: [
      { id: 'pipeline', title: 'AI Agent Pipeline' },
      { id: 'services', title: 'Service Architecture' },
      { id: 'selfhost-deploy', title: 'Self-Hosted Deployment' },
    ],
  },
  {
    id: 'admin',
    icon: '👑',
    title: 'Platform Admin',
    children: [
      { id: 'admin-panel', title: 'Admin Panel' },
      { id: 'admin-orgs', title: 'Managing Organizations' },
      { id: 'admin-users', title: 'Managing Users' },
    ],
  },
  {
    id: 'api-ref',
    icon: '📡',
    title: 'API Reference',
    children: [
      { id: 'auth-api', title: 'Authentication' },
      { id: 'tasks-api', title: 'Tasks API' },
      { id: 'flows-api', title: 'Flows API' },
      { id: 'integrations-api', title: 'Integrations API' },
    ],
  },
];

const content: Record<string, string> = {
  overview: `
AGENA is an **agentic AI platform** that autonomously generates code, creates pull requests, and manages your software development workflow.

### What AGENA Does
- **Takes a task** from your backlog (Azure DevOps, Jira, or manually created)
- **Runs an AI agent pipeline**: PM → Developer → Reviewer → Finalizer
- **Generates production code**, creates a branch, commits, and opens a PR
- **Notifies your team** via Slack, Teams, or Telegram

### Key Concepts
| Concept | Description |
|---------|-------------|
| **Task** | A work item imported from Jira/Azure or created manually |
| **Agent** | An AI role (PM, Developer, Reviewer, QA) with its own model and prompt |
| **Flow** | A visual automation pipeline connecting agents and actions |
| **Pixel Agent** | The visual workspace showing agents working in real-time |
| **Organization** | A multi-tenant workspace for your team |
  `,

  signup: `
### Creating Your Account

1. Go to [agena.dev/signup](${SITE}/signup)
2. Enter your email and password
3. You will be assigned to a new organization automatically
4. Complete the onboarding wizard to configure your first integration

### After Signup
- You are the **owner** of your organization
- Invite team members from **Dashboard → Team**
- Configure integrations from **Dashboard → Integrations**
  `,

  'quickstart-saas': `
### Using AGENA SaaS (agena.dev)

**Step 1 — Sign up** at [agena.dev/signup](${SITE}/signup)

**Step 2 — Configure Integrations** (Dashboard → Integrations)
- **AI tab**: Add your OpenAI API key (required) and optionally Gemini
- **Task tab**: Connect GitHub (for PR creation) and optionally Azure DevOps / Jira

**Step 3 — Map a Repository** (Dashboard → Mappings)
- Select your GitHub owner and repository
- This tells AGENA where to create branches and PRs

**Step 4 — Set Active Sprint** (Dashboard → Profile)
- Select your Azure/Jira project, team, and sprint
- The active sprint is auto-detected

**Step 5 — Create Your First Task**
- Go to **Dashboard → Tasks** → Create Task
- Enter a title and description (be specific about what you want)
- Click **Assign to AI** — AGENA will queue it, run the pipeline, and create a PR

**Step 6 — Monitor Progress**
- Watch the task status in the task list or **Office** view
- When done, you will see the PR link
  `,

  'quickstart-selfhost': `
### Self-Hosted Deployment

#### Prerequisites
- Docker & Docker Compose
- A server with at least 4GB RAM
- Domain with SSL (for webhook callbacks)

#### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/aozyildirim/Agena.git
cd Agena

# Copy environment configuration
cp .env.example .env
# Edit .env — set your database passwords and JWT secret

# Start all services
docker compose up -d --build
\`\`\`

#### Services Started
| Service | Port | Description |
|---------|------|-------------|
| Frontend (blue) | 3011 | Next.js dashboard |
| Frontend (green) | 3012 | Blue/green deployment pair |
| Backend API | 8010 | FastAPI server |
| Worker | — | Redis task consumer |
| MySQL | 3307 | Primary database |
| Redis | 6380 | Task queue + pub/sub |
| Qdrant | 6333 | Vector memory (optional) |

#### Nginx Setup
Configure Nginx to proxy \`yourdomain.com\` to the frontend pool (3011/3012) and \`api.yourdomain.com\` to the backend (8010). See the repo's nginx config for reference.

#### Zero-Downtime Frontend Deploy
\`\`\`bash
./scripts/deploy-frontend.sh
\`\`\`
This rebuilds one frontend container at a time while the other serves traffic.

#### Database Migrations
\`\`\`bash
docker compose exec backend alembic upgrade head
\`\`\`
  `,

  office: `
### Office — Pixel Agent Workspace

The **Office** is AGENA's visual workspace where you can see your AI agents as pixel characters working on tasks in real-time.

#### Features
- **Live agent visualization** — See which agents are active and what they are working on
- **Task progress tracking** — Visual pipeline progress (fetch → analyze → generate → review → finalize)
- **Quick actions** — Create tasks, view queue status, access recent completions
- **Interactive office** — Furniture and layout that you can customize

#### Navigation
Dashboard → Office (or click the 🏢 icon in the sidebar)
  `,

  tasks: `
### Tasks

The task management hub for all your AI-generated work items.

#### Creating Tasks
1. **Manual**: Click "Create Task" → enter title + description → Assign to AI
2. **Import from Azure DevOps**: Select project/team/sprint → Import
3. **Import from Jira**: Select project/board/sprint → Import
4. **ChatOps**: Send \`/fix login page 500 error\` from Teams/Slack/Telegram

#### Task Lifecycle
\`New → Queued → Running → Completed/Failed\`

#### Task Details
Each task shows:
- **Timeline** — Step-by-step agent execution log
- **PR link** — Direct link to the created pull request
- **Branch name** — The auto-generated branch
- **Token usage** — LLM tokens consumed and cost estimate
- **Agent model** — Which AI model was used

#### Tips
- Be specific in task descriptions — include file paths, expected behavior, and edge cases
- Use the **Story Context** and **Acceptance Criteria** fields for complex tasks
- Set **Max Tokens** to control cost per task
  `,

  sprints: `
### Sprint Board

Kanban-style board showing all tasks in your active sprint, grouped by status.

#### Setup
1. Go to **Dashboard → Profile**
2. Select your Azure DevOps or Jira project, team, and sprint
3. The sprint board automatically loads work items from the selected sprint

#### Features
- **Drag-and-drop** task state changes
- **Import all sprint items** with one click
- **Assign to AI** directly from the board
- **Filter** by state, assignee, or work item type
- **Real-time updates** via WebSocket
  `,

  'sprint-performance': `
### Sprint Performance

Analytics dashboard for your sprint velocity and AI agent effectiveness.

#### Metrics
- **Completion rate** — Percentage of tasks completed vs total
- **AI success rate** — How often the AI pipeline succeeds without errors
- **Average cycle time** — From task creation to PR merge
- **Token efficiency** — Cost per successful task
- **PR merge rate** — How many AI-generated PRs get merged
  `,

  refinement: `
### Refinement

AI-powered sprint refinement tool that analyzes backlog items and suggests story points.

#### How It Works
1. Select your source (Azure DevOps or Jira)
2. Select project → team/board → sprint
3. Click **Load Items** — shows all unestimated items
4. Select items to analyze → Click **Run Refinement**
5. The AI analyzes each item and provides:
   - **Suggested story points** with confidence score
   - **Summary** of what the item involves
   - **Ambiguities** and **Questions** to clarify
   - **Ready for planning** indicator

#### Writeback
After reviewing suggestions, click **Write Back** to update story points directly in Azure DevOps or Jira.
  `,

  agents: `
### AI Agents

Configure the AI agents that power your pipeline.

#### Default Agent Roles
| Role | Description |
|------|-------------|
| **PM** | Analyzes requirements, gathers context, creates implementation plan |
| **Developer** | Generates production code based on the plan |
| **Reviewer** | Reviews code for quality, security, and best practices |
| **QA** | Tests and validates the generated code |
| **Finalizer** | Creates branches, commits, and opens pull requests |

#### Configuration Per Agent
- **Provider**: OpenAI or Gemini
- **Model**: gpt-5, gpt-4o, gemini-2.5-pro, etc.
- **Enabled/Disabled**: Toggle each agent on or off
- **Create PR**: Whether this agent run should create a PR

#### Custom Agent Models
Each agent can use a different model. For example:
- PM: gpt-4o-mini (fast, cheap for analysis)
- Developer: gpt-5 (best quality for code generation)
- Reviewer: gpt-4o (good balance for review)
  `,

  'prompt-studio': `
### Prompt Studio

Edit and manage the system prompts used by each AI agent. All prompts are stored in the database and can be modified at runtime without redeploying.

#### Features
- **Live editing** — Changes take effect immediately
- **Version history** — See when prompts were last modified
- **Per-agent prompts** — Each agent role has its own prompt template
- **Variable interpolation** — Use \`{task_title}\`, \`{task_description}\`, \`{code_context}\` in prompts
  `,

  flows: `
### Flow Builder

Visual automation builder for creating custom AI workflows (n8n-style).

#### Node Types
| Node | Description |
|------|-------------|
| **Trigger** | Flow entry point |
| **Agent** | LLM-powered analysis/generation (select model, provider, prompt) |
| **Azure DevOps** | Create branch, create PR, complete PR, abandon PR |
| **GitHub** | Create branch, create PR, merge PR |
| **HTTP** | REST API calls with auth (bearer, API key, basic) |
| **Condition** | Branch logic (eq, neq, contains, regex, etc.) |
| **Notify** | Webhook, Slack, or email notifications |
| **Azure Update** | Update work item state + add comment |

#### Node Communication
Nodes pass data via \`{{outputs.node_id.field}}\`. Each node's output is available to downstream nodes.

#### Creating a Flow
1. Go to **Dashboard → Flows** → Create New Flow
2. Add a Trigger node
3. Connect Agent nodes for analysis and code generation
4. Add a GitHub/Azure node to create the PR
5. Save and activate the flow
  `,

  templates: `
### Templates

Reusable task and flow templates for common development patterns.

#### Usage
- Browse pre-built templates for common tasks (bug fix, feature, refactor)
- Create your own templates from successful task configurations
- Apply templates when creating new tasks to pre-fill description, context, and settings
  `,

  dora: `
### DORA Metrics

DevOps Research and Assessment (DORA) metrics dashboard.

#### Available Views
- **Overview** — High-level DORA summary
- **Project** — Per-project delivery metrics
- **Development** — Code velocity, commit frequency, PR throughput
- **Quality** — Code review time, defect density, test coverage
- **Bugs** — Bug tracking, resolution time, severity distribution
- **Team** — Per-developer performance and workload balance

#### Metrics Tracked
- **Deployment Frequency** — How often code is deployed
- **Lead Time for Changes** — Time from commit to production
- **Change Failure Rate** — Percentage of deployments causing failures
- **Mean Time to Recovery** — How quickly failures are resolved
  `,

  integrations: `
### Integrations Setup

Configure external services in **Dashboard → Integrations**.

#### AI Tab
- **OpenAI** — API key + base URL (required for code generation)
- **Gemini** — Google AI API key (optional fallback provider)
- **Playbook** — Organization-wide coding rules and conventions. The AI agents reference these rules when generating code.

#### Task Tab
- **GitHub** — Owner + Personal Access Token (PAT) with \`repo\` scope. Used for branch/PR creation.
- **Azure DevOps** — Organization URL + Project + PAT with Code (Read & Write) scope
- **Jira** — Base URL + Email + API token. Used for task import and sprint sync.

#### Notifications Tab
- **Slack** — Webhook URL (notifications) + Bot Token + Signing Secret (ChatOps)
- **Teams** — Webhook URL (notifications) + Bot App ID + Bot App Secret (ChatOps)
- **Telegram** — Bot Token (from @BotFather) + Chat ID

#### CLI Tab
- **CLI Bridge** — Status of Codex and Claude CLI agent connections
  `,

  'repo-mapping': `
### Repository Mapping

Repository mapping tells AGENA which codebase to work with for each task.

#### Setup
1. Go to **Dashboard → Mappings**
2. Click **Add Mapping**
3. Select your GitHub owner and repository
4. Optionally set:
   - **Base branch** (default: main)
   - **Local repo path** (for self-hosted setups with volume-mounted repos)
   - **Playbook** (coding rules specific to this repo)

#### How It Works
When a task is assigned to AI, AGENA:
1. Checks the task's repository mapping
2. Fetches the codebase context from the mapped repo
3. Generates code following the repo's conventions
4. Creates a branch and PR in that specific repository

#### Multiple Repos
You can map multiple repositories. When creating a task, select which repo it applies to.
  `,

  'team-management': `
### Team & Permissions

Manage your organization's team members and their access levels.

#### Roles
| Role | Permissions |
|------|-------------|
| **Owner** | Full access, billing, delete org |
| **Admin** | Manage team, integrations, settings |
| **Member** | Create tasks, view results, use agents |
| **Viewer** | Read-only access to tasks and dashboards |

#### Inviting Members
1. Go to **Dashboard → Team**
2. Click **Invite** → enter email address
3. Select the role to assign
4. The invitee receives an email with a signup/join link

#### Permissions
Fine-grained permissions available at **Dashboard → Permissions**:
- \`tasks:read\`, \`tasks:write\`, \`tasks:assign\`
- \`integrations:manage\`
- \`team:manage\`, \`roles:manage\`
- \`flows:manage\`, \`prompts:manage\`
  `,

  'profile-settings': `
### Profile & Preferences

Configure your personal workspace preferences at **Dashboard → Profile**.

#### Active Sprint Selection
- **Azure DevOps**: Select Project → Team → Sprint (active sprint auto-detected)
- **Jira**: Select Project → Board → Sprint (active sprint auto-detected)

#### Workspace Preferences
- **Email / Web Push / In-app notifications** — Toggle per channel
- **Daily summary email** — Get a daily digest of task activity
- **Auto-assign new tasks** — Automatically queue imported tasks for AI
- **Default create PR** — Whether AI tasks should create PRs by default
- **Preferred provider & model** — Default AI model for new tasks

#### Branch Naming Pattern
Choose from presets or define a custom pattern:
- \`feature/AB#{ext_id}-{title_slug}\` → \`feature/AB#61717-merchant-status\`
- \`feature/{ext_id}-{title_slug}\` → \`feature/61717-merchant-status\`
- \`bugfix/{ext_id}\` → \`bugfix/61717\`

#### Notification Matrix
Per-event control over which channels receive notifications (in-app, email, web push).
  `,

  chatops: `
### ChatOps — Teams / Slack / Telegram

Control AGENA directly from your chat platform.

#### Available Commands
| Command | Description |
|---------|-------------|
| \`help\` | Show available commands |
| \`fix <description>\` | Create task + assign to AI immediately |
| \`create <title>\` | Create task without auto-assign |
| \`status <task_id>\` | Get task status and details |
| \`queue\` | Show queue size and running tasks |
| \`cancel <task_id>\` | Cancel a queued task |
| \`recent [count]\` | List recent tasks (default: 5) |
| \`stats\` | Organization statistics and success rate |

#### Setup

**Telegram**
1. Message \`@BotFather\` on Telegram → \`/newbot\`
2. Copy the Bot Token
3. Dashboard → Integrations → Telegram → paste token → Save
4. Webhook is auto-registered

**Slack**
1. Create a Slack App at api.slack.com/apps
2. Enable Event Subscriptions → Request URL: \`https://api.agena.dev/webhooks/slack\`
3. Subscribe to: \`app_mention\`, \`message.im\`
4. Copy Bot Token + Signing Secret
5. Dashboard → Integrations → Slack → paste both → Save

**Teams**
1. Register a Bot in Azure Portal → Azure Bot Service
2. Enable Microsoft Teams channel
3. Set Messaging Endpoint to: \`https://api.agena.dev/webhooks/teams\`
4. Copy App ID + App Secret
5. Dashboard → Integrations → Teams → paste both → Save
  `,

  pipeline: `
### AI Agent Pipeline

AGENA uses a two-layer orchestration system:

#### CrewAI — Agent Roles
Each agent has a specific role, model, and system prompt:
- **PM Agent**: Analyzes the task, gathers codebase context, creates a detailed implementation plan
- **Developer Agent**: Generates production code following the plan and repo conventions
- **Reviewer Agent**: Reviews generated code for bugs, security issues, and best practices
- **Finalizer Agent**: Creates a git branch, commits code, and opens a pull request

#### LangGraph — Execution Pipeline
\`\`\`
fetch_context → analyze → generate_code → review_code → finalize
\`\`\`

Each node passes data to the next via a shared context. The pipeline supports:
- **Retry logic** — Failed stages can be retried automatically
- **Token budgets** — Per-task token limits to control cost
- **Model routing** — Automatic model selection based on task complexity
- **Memory** — Vector memory (Qdrant) for learning from past tasks
  `,

  services: `
### Service Architecture

AGENA is a monorepo with 6 pip-installable Python packages:

| Package | Description |
|---------|-------------|
| \`agena-core\` | Settings, database, auth, RBAC, JWT, security |
| \`agena-models\` | 25 SQLAlchemy ORM models + Pydantic schemas |
| \`agena-services\` | 31 business logic services + integrations |
| \`agena-agents\` | CrewAI + LangGraph pipeline + vector memory |
| \`agena-api\` | FastAPI routes, middleware, dependencies |
| \`agena-worker\` | Redis background task consumer |

#### Tech Stack
- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0 (async), MySQL 8, Redis 7
- **AI**: LangGraph, CrewAI, OpenAI SDK (GPT-5, Gemini fallback)
- **Frontend**: Next.js 14, React 18, TypeScript, 7 languages
- **Auth**: JWT, bcrypt, RBAC (owner/admin/member/viewer)
- **Deploy**: Docker Compose, Nginx (blue/green frontend)
  `,

  'selfhost-deploy': `
### Self-Hosted Deployment

#### Docker Compose Services
\`\`\`yaml
services:
  backend:    # FastAPI API server (port 8010)
  worker:     # Redis task consumer
  frontend_blue:   # Next.js (port 3011)
  frontend_green:  # Next.js (port 3012)
  mysql:      # MySQL 8 (port 3307)
  redis:      # Redis 7 (port 6380)
  qdrant:     # Vector memory (port 6333, optional)
\`\`\`

#### Environment Variables
All configuration is via \`.env\`. Key variables:

\`\`\`bash
# Required
JWT_SECRET_KEY=your-random-secret
MYSQL_PASSWORD=secure-password

# AI Provider (at least one required)
OPENAI_API_KEY=sk-...

# Optional
QDRANT_ENABLED=false
MAX_WORKERS=8
\`\`\`

Integrations (GitHub, Azure, Jira, Slack, Teams, Telegram) are configured per-organization via the dashboard — no env vars needed.

#### Production Checklist
- [ ] Set strong JWT_SECRET_KEY and database passwords
- [ ] Configure SSL certificates for your domain
- [ ] Set up Nginx reverse proxy (see repo for example config)
- [ ] Run database migrations: \`docker compose exec backend alembic upgrade head\`
- [ ] Create your first account at \`yourdomain.com/signup\`
- [ ] Configure integrations via the dashboard
  `,

  'admin-panel': `
### Platform Admin Panel

The admin panel is accessible at **Dashboard → Admin** for users with platform admin privileges.

#### Overview Tab
- Total organizations, users, tasks, and PRs created
- System health indicators

#### Accessing Admin
Platform admin is set at the database level (\`is_platform_admin=true\` on the user record). The first user created typically has this flag.
  `,

  'admin-orgs': `
### Managing Organizations

In the **Organizations** tab of the admin panel:
- View all registered organizations
- See member count, task count, and creation date per org
- Monitor usage across tenants
  `,

  'admin-users': `
### Managing Users

In the **Users** tab of the admin panel:
- View all registered users across all organizations
- See email, role, last login, and organization assignment
- Contact form submissions and newsletter subscribers are also visible here
  `,

  'auth-api': `
### Authentication API

\`\`\`bash
# Sign up
POST /auth/signup
{"email": "...", "password": "...", "full_name": "..."}

# Login
POST /auth/login
{"email": "...", "password": "..."}
# Returns: {"access_token": "eyJ...", "token_type": "bearer"}

# Get current user
GET /auth/me
Authorization: Bearer <token>
\`\`\`

All subsequent API calls require the \`Authorization: Bearer <token>\` header.
  `,

  'tasks-api': `
### Tasks API

\`\`\`bash
# Create task
POST /tasks
{"title": "Fix login bug", "description": "..."}

# List tasks
GET /tasks

# Get task detail
GET /tasks/{id}

# Assign to AI
POST /tasks/{id}/assign
{"create_pr": true, "mode": "flow"}

# Cancel task
POST /tasks/{id}/cancel

# Import from Azure DevOps
POST /tasks/import/azure
{"project": "MyProject", "team": "MyTeam", "sprint_path": "..."}

# Import from Jira
POST /tasks/import/jira
{"project_key": "PROJ", "board_id": "1", "sprint_id": "2"}
\`\`\`
  `,

  'flows-api': `
### Flows API

\`\`\`bash
# List flows
GET /flows

# Create flow
POST /flows
{"name": "My Pipeline", "nodes": [...], "edges": [...]}

# Run flow
POST /flows/{id}/run
{"task_id": 123}

# Get flow detail
GET /flows/{id}
\`\`\`

Full OpenAPI docs available at \`https://api.agena.dev/docs\` (Swagger UI).
  `,

  'integrations-api': `
### Integrations API

\`\`\`bash
# List all integrations
GET /integrations

# Configure a provider
PUT /integrations/{provider}
{"base_url": "...", "secret": "...", "project": "...", "username": "..."}

# Supported providers:
# jira, azure, github, openai, gemini, slack, teams, telegram, playbook

# Delete integration
DELETE /integrations/{provider}

# List GitHub repos (after configuring GitHub)
GET /integrations/github/repos

# List GitHub branches
GET /integrations/github/branches?owner=...&repo=...
\`\`\`
  `,
};

function SidebarItem({ id, title, active, onClick }: { id: string; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: 6, border: 'none',
        background: active ? 'rgba(13,148,136,0.12)' : 'transparent',
        color: active ? '#5eead4' : 'var(--ink-50)', fontSize: 13, cursor: 'pointer', fontWeight: active ? 600 : 400,
      }}
    >
      {title}
    </button>
  );
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="color:var(--ink-90);font-size:17px;font-weight:700;margin:28px 0 10px">$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4 style="color:var(--ink-80);font-size:15px;font-weight:700;margin:20px 0 8px">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--ink-90)">$1</strong>')
    .replace(/`([^`\n]+)`/g, '<code style="background:rgba(13,148,136,0.1);color:var(--accent);padding:2px 6px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre style="background:var(--terminal-bg, #0d1117);border:1px solid var(--panel-border-2);border-radius:10px;padding:16px;overflow-x:auto;font-size:12px;color:var(--ink-65);margin:14px 0;line-height:1.6"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
    )
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(Boolean).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return '';
      return `<tr>${cells.map(c => `<td style="padding:8px 12px;border:1px solid var(--panel-border-2);font-size:13px">${c}</td>`).join('')}</tr>`;
    })
    .replace(/((<tr>.*<\/tr>\s*)+)/g, '<table style="width:100%;border-collapse:collapse;margin:14px 0">$1</table>')
    .replace(/^- \[x\] (.+)$/gm, '<li style="margin:4px 0;color:var(--ink-58);font-size:13px;list-style:none">✅ $1</li>')
    .replace(/^- \[ \] (.+)$/gm, '<li style="margin:4px 0;color:var(--ink-58);font-size:13px;list-style:none">⬜ $1</li>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;color:var(--ink-58);font-size:13px">$1</li>')
    .replace(/((<li.*<\/li>\s*)+)/g, '<ul style="margin:8px 0;padding-left:20px">$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;color:var(--ink-58);font-size:13px">$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent);text-decoration:underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^(?!<[a-z])((?!\s*$).+)$/gm, '<p style="margin:8px 0;color:var(--ink-58);font-size:14px;line-height:1.7">$1</p>')
    .replace(/<p[^>]*><\/p>/g, '');
}

export default function DocsPage() {
  const [activeId, setActiveId] = useState('overview');

  const activeContent = content[activeId] || '';
  const activeSection = sections.flatMap(s => s.children).find(c => c.id === activeId);
  const parentSection = sections.find(s => s.children.some(c => c.id === activeId));

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
      {/* Sidebar */}
      <nav style={{ width: 240, flexShrink: 0, padding: '24px 0', borderRight: '1px solid var(--panel-border)', position: 'sticky', top: 64, height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
        {sections.map((section) => (
          <div key={section.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-35)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 12px', marginBottom: 4 }}>
              {section.icon} {section.title}
            </div>
            {section.children.map((child) => (
              <SidebarItem
                key={child.id}
                id={child.id}
                title={child.title}
                active={activeId === child.id}
                onClick={() => { setActiveId(child.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: '32px 0 64px 40px', minWidth: 0 }}>
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ink-30)' }}>
          {parentSection && <>{parentSection.icon} {parentSection.title} → </>}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-90)', margin: '0 0 24px' }}>
          {activeSection?.title || 'Documentation'}
        </h1>
        <div
          style={{ maxWidth: 720 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(activeContent) }}
        />

        {/* Prev / Next navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--panel-border)' }}>
          {(() => {
            const allChildren = sections.flatMap(s => s.children);
            const idx = allChildren.findIndex(c => c.id === activeId);
            const prev = idx > 0 ? allChildren[idx - 1] : null;
            const next = idx < allChildren.length - 1 ? allChildren[idx + 1] : null;
            return (
              <>
                {prev ? (
                  <button onClick={() => { setActiveId(prev.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--panel-border-2)', background: 'var(--panel)', color: 'var(--ink-65)', fontSize: 13, cursor: 'pointer' }}>
                    ← {prev.title}
                  </button>
                ) : <div />}
                {next ? (
                  <button onClick={() => { setActiveId(next.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(13,148,136,0.3)', background: 'rgba(13,148,136,0.08)', color: '#5eead4', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {next.title} →
                  </button>
                ) : <div />}
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
