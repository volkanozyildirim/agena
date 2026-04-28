'use client';

import { useEffect, useMemo, useRef } from 'react';

type TaskLog = {
  id?: number;
  stage: string;
  message: string;
  created_at: string;
};

type Props = {
  logs: TaskLog[];
  running?: boolean;
  emptyLabel?: string;
};

/**
 * Renders the agent's tool calls as a live, vertical timeline. Reads the
 * existing `logs` array (kept fresh by the SSE stream + WebSocket
 * `agent_log` events upstream) and parses messages of the form
 * `[Read: /path]`, `[Edit: /path]`, `[Bash: cmd]`, `[Tool: Name]`,
 * `[Grep: pattern]`, `[Write: /path]`, `[Glob: pattern]` into typed cards.
 * Anything that doesn't look like a tool call is rendered as a softer
 * narrative line so the user still sees lifecycle events (created,
 * queued, run_metrics, etc.) without losing the visual rhythm.
 */
export default function AgentTimeline({ logs, running = false, emptyLabel }: Props) {
  const items = useMemo(() => buildItems(logs), [logs]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!running) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items.length, running]);

  if (items.length === 0) {
    return (
      <div style={{ padding: 22, color: 'var(--ink-35)', fontSize: 13, textAlign: 'center' }}>
        {emptyLabel ?? 'Waiting for the agent to start working…'}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', padding: '14px 16px 18px' }}>
      <div
        style={{
          position: 'absolute', left: 30, top: 14, bottom: 18, width: 2,
          background: 'linear-gradient(to bottom, transparent, var(--panel-border) 12%, var(--panel-border) 88%, transparent)',
        }}
      />
      <div style={{ display: 'grid', gap: 8, position: 'relative' }}>
        {items.map((it, idx) => (
          <TimelineRow key={`${it.id ?? idx}-${it.kind}`} item={it} pulsing={idx === items.length - 1 && running} />
        ))}
      </div>
      <div ref={endRef} />
    </div>
  );
}


type ToolKind =
  | 'read' | 'edit' | 'write' | 'bash' | 'grep' | 'glob' | 'tool'
  | 'lifecycle';

type Item = {
  id?: number;
  kind: ToolKind;
  label: string;
  body: string;
  ts: string;
  raw: string;
};

const TOOL_PATTERNS: { kind: ToolKind; label: string; re: RegExp }[] = [
  { kind: 'read',  label: 'Read',  re: /^\[Read:\s*(.+)\]\s*$/i },
  { kind: 'edit',  label: 'Edit',  re: /^\[Edit:\s*(.+)\]\s*$/i },
  { kind: 'write', label: 'Write', re: /^\[Write:\s*(.+)\]\s*$/i },
  { kind: 'bash',  label: 'Bash',  re: /^\[Bash:\s*(.+)\]\s*$/i },
  { kind: 'grep',  label: 'Grep',  re: /^\[Grep:\s*(.+)\]\s*$/i },
  { kind: 'glob',  label: 'Glob',  re: /^\[Glob:\s*(.+)\]\s*$/i },
  { kind: 'tool',  label: 'Tool',  re: /^\[Tool:\s*(.+)\]\s*$/i },
];

const LIFECYCLE_STAGES = new Set([
  'created', 'queued', 'agent', 'failed', 'completed',
  'memory_impact', 'run_metrics', 'notify', 'mirror',
  'repo_mapping', 'local_exec', 'finalize',
]);

function buildItems(logs: TaskLog[]): Item[] {
  const out: Item[] = [];
  for (const log of logs) {
    const msg = (log.message || '').trim();
    let matched = false;
    for (const p of TOOL_PATTERNS) {
      const m = msg.match(p.re);
      if (m) {
        out.push({
          id: log.id,
          kind: p.kind,
          label: p.label,
          body: m[1].trim(),
          ts: log.created_at,
          raw: msg,
        });
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (LIFECYCLE_STAGES.has(log.stage)) {
      out.push({
        id: log.id,
        kind: 'lifecycle',
        label: log.stage,
        body: msg,
        ts: log.created_at,
        raw: msg,
      });
    }
  }
  return out;
}


function TimelineRow({ item, pulsing }: { item: Item; pulsing: boolean }) {
  const meta = STYLE[item.kind];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{
            width: 22, height: 22, borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: meta.bg, color: meta.fg,
            border: `1px solid ${meta.ring}`,
            boxShadow: pulsing ? `0 0 0 4px ${meta.ring}33` : 'none',
            animation: pulsing ? 'agent-tl-pulse 1.4s ease-in-out infinite' : 'none',
            zIndex: 1, fontSize: 12, fontWeight: 700, lineHeight: 1,
          }}
        >
          {meta.icon}
        </span>
      </div>
      <div
        style={{
          padding: '8px 12px', borderRadius: 10,
          border: '1px solid var(--panel-border)',
          background: 'var(--panel)',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: meta.fg }}>
            {item.label}
          </span>
          <span style={{ fontSize: 10, color: 'var(--ink-42)' }}>
            {fmtTime(item.ts)}
          </span>
        </div>
        <div
          style={{
            fontSize: 12.5, color: item.kind === 'lifecycle' ? 'var(--ink-58)' : 'var(--ink-90)',
            fontFamily: item.kind === 'bash' || item.kind === 'grep' || item.kind === 'glob' ? 'var(--font-mono, monospace)' : 'inherit',
            lineHeight: 1.45, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
            maxHeight: 160, overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {item.kind === 'read' || item.kind === 'edit' || item.kind === 'write'
            ? prettyPath(item.body)
            : item.body}
        </div>
      </div>
      <style jsx>{`
        @keyframes agent-tl-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}


function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function prettyPath(p: string): string {
  // Strip the redundant project prefix so paths fit on one line. We keep the
  // tail (e.g. `app/Model/V1/Product.php`) which is what humans recognise.
  const cleaned = p.replace(/.*?\/(?=app\/|src\/|frontend\/|packages\/|alembic\/|docs\/|scripts\/|tests\/)/i, '');
  return cleaned || p;
}


const STYLE: Record<ToolKind, { icon: string; bg: string; fg: string; ring: string }> = {
  read:      { icon: '👁',  bg: 'rgba(56,189,248,0.18)',  fg: '#7dd3fc', ring: 'rgba(56,189,248,0.45)' },
  edit:      { icon: '✏',  bg: 'rgba(245,158,11,0.18)',  fg: '#fbbf24', ring: 'rgba(245,158,11,0.45)' },
  write:     { icon: '+',  bg: 'rgba(34,197,94,0.20)',   fg: '#86efac', ring: 'rgba(34,197,94,0.45)' },
  bash:      { icon: '$',  bg: 'rgba(168,85,247,0.18)',  fg: '#d8b4fe', ring: 'rgba(168,85,247,0.45)' },
  grep:      { icon: '⌕',  bg: 'rgba(20,184,166,0.18)',  fg: '#5eead4', ring: 'rgba(20,184,166,0.45)' },
  glob:      { icon: '✱',  bg: 'rgba(20,184,166,0.18)',  fg: '#5eead4', ring: 'rgba(20,184,166,0.45)' },
  tool:      { icon: '◆',  bg: 'rgba(94,234,212,0.16)',  fg: '#5eead4', ring: 'rgba(94,234,212,0.4)'  },
  lifecycle: { icon: '·',  bg: 'rgba(148,163,184,0.16)', fg: '#94a3b8', ring: 'rgba(148,163,184,0.35)' },
};
