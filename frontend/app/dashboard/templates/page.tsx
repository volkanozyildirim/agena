'use client';

import { useEffect, useMemo, useState } from 'react';
import { createFlowTemplate, deleteFlowTemplate, FlowTemplate, listFlowTemplates, loadPrefs, savePrefs } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

type FlowLite = {
  id: string;
  name: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  createdAt: string;
};

function starterTemplates(t: ReturnType<typeof useLocale>['t']): Array<{ name: string; description: string; flow: Record<string, unknown> }> {
  return [
    {
      name: t('flows.preset.prReviewLoop.name'),
      description: t('templates.preset.prReviewLoop.description'),
      flow: {
        id: 'template-pr-review-loop',
        name: t('flows.preset.prReviewLoop.name'),
        createdAt: new Date().toISOString(),
        nodes: [
          { id: 'p1', type: 'trigger', role: 'trigger', label: t('flows.preset.prReviewLoop.p1.label'), icon: '🧾', color: '#f59e0b', action: t('flows.preset.prReviewLoop.p1.action'), waitForApproval: false, x: 60, y: 150 },
          { id: 'p2', type: 'agent', role: 'developer', label: t('flows.preset.prReviewLoop.p2.label'), icon: '⚡', color: '#22c55e', action: t('flows.preset.prReviewLoop.p2.action'), execute_task_pipeline: true, create_pr: true, waitForApproval: false, x: 280, y: 150 },
          { id: 'p3', type: 'github', role: 'github', label: t('flows.preset.prReviewLoop.p3.label'), icon: '🐙', color: '#6e40c9', action: t('flows.preset.prReviewLoop.p3.action'), github_action: 'create_pr', pr_title: 'AI: {{title}}', waitForApproval: false, x: 500, y: 150 },
          { id: 'p4', type: 'agent', role: 'lead_developer', label: t('flows.preset.prReviewLoop.p4.label'), icon: '🧑‍💻', color: '#38bdf8', action: t('flows.preset.prReviewLoop.p4.action'), review_only: true, auto_fix_from_comments: true, waitForApproval: true, x: 720, y: 150 },
        ],
        edges: [{ from: 'p1', to: 'p2' }, { from: 'p2', to: 'p3' }, { from: 'p3', to: 'p4' }],
      },
    },
    {
      name: t('templates.preset.enterprise.name'),
      description: t('templates.preset.enterprise.description'),
      flow: {
        id: 'template-enterprise',
        name: t('templates.preset.enterprise.name'),
        createdAt: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'agent', role: 'pm', label: t('templates.preset.enterprise.n1.label'), icon: '📋', color: '#a78bfa', action: t('templates.preset.enterprise.n1.action'), waitForApproval: false, x: 60, y: 120 },
          { id: 'n2', type: 'agent', role: 'lead_developer', label: t('templates.preset.enterprise.n2.label'), icon: '🧑‍💻', color: '#38bdf8', action: t('templates.preset.enterprise.n2.action'), waitForApproval: true, x: 280, y: 120 },
          { id: 'n3', type: 'condition', role: 'condition', label: t('templates.preset.enterprise.n3.label'), icon: '🔐', color: '#22c55e', action: t('templates.preset.enterprise.n3.action'), waitForApproval: true, x: 500, y: 120 },
          { id: 'n4', type: 'agent', role: 'developer', label: t('templates.preset.enterprise.n4.label'), icon: '⚡', color: '#22c55e', action: t('templates.preset.enterprise.n4.action'), waitForApproval: false, x: 720, y: 120 },
        ],
        edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n3', to: 'n4' }],
      },
    },
    {
      name: t('templates.preset.hotfix.name'),
      description: t('templates.preset.hotfix.description'),
      flow: {
        id: 'template-hotfix',
        name: t('templates.preset.hotfix.name'),
        createdAt: new Date().toISOString(),
        nodes: [
          { id: 'h1', type: 'trigger', role: 'trigger', label: t('templates.preset.hotfix.h1.label'), icon: '🚨', color: '#f59e0b', action: t('templates.preset.hotfix.h1.action'), waitForApproval: false, x: 60, y: 180 },
          { id: 'h2', type: 'agent', role: 'lead_developer', label: t('templates.preset.hotfix.h2.label'), icon: '🧑‍💻', color: '#38bdf8', action: t('templates.preset.hotfix.h2.action'), waitForApproval: true, x: 280, y: 180 },
          { id: 'h3', type: 'agent', role: 'developer', label: t('templates.preset.hotfix.h3.label'), icon: '⚡', color: '#22c55e', action: t('templates.preset.hotfix.h3.action'), waitForApproval: false, x: 500, y: 180 },
          { id: 'h4', type: 'notify', role: 'notify', label: t('templates.preset.hotfix.h4.label'), icon: '🔔', color: '#fb923c', action: t('templates.preset.hotfix.h4.action'), waitForApproval: false, x: 720, y: 180 },
        ],
        edges: [{ from: 'h1', to: 'h2' }, { from: 'h2', to: 'h3' }, { from: 'h3', to: 'h4' }],
      },
    },
  ];
}

function localizeTemplateMeta(template: FlowTemplate, t: ReturnType<typeof useLocale>['t']) {
  const flow = template.flow as unknown as FlowLite | null;
  const flowId = flow?.id ?? '';
  if (flowId === 'template-pr-review-loop') {
    return { name: t('flows.preset.prReviewLoop.name'), description: t('templates.preset.prReviewLoop.description') };
  }
  if (flowId === 'template-enterprise') {
    return { name: t('templates.preset.enterprise.name'), description: t('templates.preset.enterprise.description') };
  }
  if (flowId === 'template-hotfix') {
    return { name: t('templates.preset.hotfix.name'), description: t('templates.preset.hotfix.description') };
  }
  return { name: template.name, description: template.description || '' };
}

export default function TemplatesPage() {
  const { t } = useLocale();
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setTemplates(await listFlowTemplates());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('templates.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function installStarters() {
    setError('');
    try {
      for (const s of starterTemplates(t)) {
        await createFlowTemplate({ name: s.name, description: s.description, flow: s.flow });
      }
      setMessage(t('flows.templatesInstalled'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('templates.installFailed'));
    }
  }

  async function removeTemplate(id: number) {
    try {
      await deleteFlowTemplate(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('templates.deleteFailed'));
    }
  }

  async function importToFlows(template: FlowTemplate) {
    try {
      const prefs = await loadPrefs();
      const flows = (prefs.flows ?? []) as unknown as FlowLite[];
      const raw = template.flow as unknown as FlowLite;
      const flowId = String(Date.now());
      const nodes = (raw.nodes ?? []).map((n, i) => ({ ...n, id: `n_${flowId}_${i}` }));
      const oldNodes = raw.nodes ?? [];
      const edges = (raw.edges ?? []).map((e) => {
        const from = String((e as Record<string, unknown>).from ?? '');
        const to = String((e as Record<string, unknown>).to ?? '');
        const fromIdx = oldNodes.findIndex((n) => String((n as Record<string, unknown>).id ?? '') === from);
        const toIdx = oldNodes.findIndex((n) => String((n as Record<string, unknown>).id ?? '') === to);
        return { from: `n_${flowId}_${fromIdx}`, to: `n_${flowId}_${toIdx}` };
      });
      const imported: FlowLite = {
        id: flowId,
        name: localizeTemplateMeta(template, t).name,
        createdAt: new Date().toISOString(),
        nodes,
        edges,
      };
      await savePrefs({ flows: [...flows, imported] as unknown as Record<string, unknown>[] });
      setMessage(`${t('flows.templatesImported')}: ${localizeTemplateMeta(template, t).name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('templates.importFailed'));
    }
  }

  const empty = useMemo(() => !loading && templates.length === 0, [loading, templates.length]);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div>
        <div className='section-label'>{t('nav.templates')}</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink-90)', marginTop: 6 }}>{t('flows.templateMarketplace')}</h1>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => void installStarters()} className='button button-primary' style={{ padding: '9px 14px', fontSize: 13 }}>
          {t('flows.templatesInstallStarter')}
        </button>
        <button onClick={() => void load()} className='button button-outline' style={{ padding: '9px 14px', fontSize: 13 }}>
          {t('flows.templatesRefresh')}
        </button>
      </div>

      {(message || error) && (
        <div style={{ borderRadius: 10, padding: '10px 12px', border: '1px solid ' + (error ? 'rgba(248,113,113,0.35)' : 'rgba(34,197,94,0.3)'), background: error ? 'rgba(248,113,113,0.08)' : 'rgba(34,197,94,0.08)', color: error ? '#f87171' : '#22c55e', fontSize: 13 }}>
          {error || message}
        </div>
      )}

      {empty && (
        <div style={{ borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)', padding: 18, color: 'var(--ink-50)', fontSize: 13 }}>
          {t('flows.templatesEmpty')}
        </div>
      )}

      <div className="dash-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: 12 }}>
        {templates.map((tp) => (
          <div key={tp.id} style={{ borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)', padding: 14 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink-90)', marginBottom: 6 }}>{localizeTemplateMeta(tp, t).name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-42)', marginBottom: 12 }}>{localizeTemplateMeta(tp, t).description || t('templates.noDescription')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void importToFlows(tp)} style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid rgba(56,189,248,0.35)', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                {t('flows.importTemplate')}
              </button>
              <button onClick={() => void removeTemplate(tp.id)} style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                {t('flows.templatesDelete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
