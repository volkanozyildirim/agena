'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { loadPrefs, savePrefs } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type AgentRole = 'lead_developer' | 'pm' | 'qa' | 'manager' | 'developer' | string;

interface FlowNode {
  id: string;
  role: AgentRole;
  label: string;
  icon: string;
  color: string;
  action: string;
  waitForApproval: boolean;
  x: number;
  y: number;
}

interface FlowEdge {
  from: string; // node id
  to: string;   // node id
}

interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
}

const AGENT_PRESETS: { role: AgentRole; label: string; icon: string; color: string }[] = [
  { role: 'manager',        label: 'Manager',         icon: '👔', color: '#f59e0b' },
  { role: 'pm',             label: 'Product Manager', icon: '📋', color: '#a78bfa' },
  { role: 'lead_developer', label: 'Lead Developer',  icon: '🧑‍💻', color: '#38bdf8' },
  { role: 'developer',      label: 'Developer',       icon: '⚡', color: '#22c55e' },
  { role: 'qa',             label: 'QA Engineer',     icon: '🔍', color: '#f472b6' },
];

const PRESET_FLOWS: Flow[] = [
  {
    id: 'full-cycle',
    name: 'Full Dev Cycle',
    createdAt: new Date().toISOString(),
    nodes: [
      { id: 'n1', role: 'pm',             label: 'PM Analiz',      icon: '📋', color: '#a78bfa', action: 'Acceptance criteria yaz', waitForApproval: false, x: 60,  y: 160 },
      { id: 'n2', role: 'lead_developer', label: 'Teknik Plan',    icon: '🧑‍💻', color: '#38bdf8', action: 'Implementasyon planı',   waitForApproval: true,  x: 280, y: 160 },
      { id: 'n3', role: 'developer',      label: 'Geliştirme',     icon: '⚡', color: '#22c55e', action: 'Kodu yaz, PR aç',         waitForApproval: false, x: 500, y: 160 },
      { id: 'n4', role: 'qa',             label: 'QA Test',        icon: '🔍', color: '#f472b6', action: 'Test senaryoları çalıştır', waitForApproval: false, x: 720, y: 160 },
    ],
    edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n3', to: 'n4' }],
  },
  {
    id: 'quick-fix',
    name: 'Quick Fix',
    createdAt: new Date().toISOString(),
    nodes: [
      { id: 'n1', role: 'lead_developer', label: 'Root Cause', icon: '🧑‍💻', color: '#38bdf8', action: "Bug'ı analiz et", waitForApproval: false, x: 60,  y: 160 },
      { id: 'n2', role: 'developer',      label: 'Fix',        icon: '⚡', color: '#22c55e', action: 'Fix uygula, PR aç',  waitForApproval: false, x: 280, y: 160 },
      { id: 'n3', role: 'qa',             label: 'Verify',     icon: '🔍', color: '#f472b6', action: 'Regression test',   waitForApproval: false, x: 500, y: 160 },
    ],
    edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }],
  },
];

const LS_FLOWS = 'tiqr_flows';
function loadFlows(): Flow[] {
  if (typeof window === 'undefined') return PRESET_FLOWS;
  try {
    const s = localStorage.getItem(LS_FLOWS);
    if (!s) return PRESET_FLOWS;
    const parsed = JSON.parse(s) as Flow[];
    return parsed.map((f) => ({ ...f, nodes: f.nodes ?? [], edges: f.edges ?? [] }));
  }
  catch { return PRESET_FLOWS; }
}
function saveFlowsLS(flows: Flow[]) { localStorage.setItem(LS_FLOWS, JSON.stringify(flows)); }

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>(PRESET_FLOWS);
  const [activeFlow, setActiveFlow] = useState<string>('full-cycle');
  const [creating, setCreating] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');

  useEffect(() => {
    const local = loadFlows();
    setFlows(local);
    if (local.length) setActiveFlow(local[0].id);
    loadPrefs().then((p) => {
      if (p.flows?.length) {
        // nodes/edges undefined olabilir — normalize et
        const db = (p.flows as unknown as Flow[]).map((f) => ({
          ...f,
          nodes: f.nodes ?? [],
          edges: f.edges ?? [],
        }));
        setFlows(db); saveFlowsLS(db);
        setActiveFlow(db[0].id);
      }
    }).catch(() => {});
  }, []);

  async function persist(next: Flow[]) {
    setFlows(next); saveFlowsLS(next);
    try { await savePrefs({ flows: next as unknown as Record<string, unknown>[] }); } catch { /* ok */ }
  }

  function createFlow() {
    if (!newFlowName.trim()) return;
    const f: Flow = {
      id: Date.now().toString(), name: newFlowName.trim(),
      nodes: [], edges: [], createdAt: new Date().toISOString(),
    };
    const next = [...flows, f];
    void persist(next);
    setActiveFlow(f.id);
    setCreating(false); setNewFlowName('');
  }

  function deleteFlow(id: string) {
    const next = flows.filter((f) => f.id !== id);
    void persist(next);
    setActiveFlow(next[0]?.id ?? '');
  }

  function updateFlow(updated: Flow) {
    const next = flows.map((f) => f.id === updated.id ? updated : f);
    void persist(next);
  }

  const current = flows.find((f) => f.id === activeFlow);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 104px)', gap: 0 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 16px', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="section-label">Flows</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.95)', margin: '4px 0 0' }}>Agent Flowları</h1>
        </div>
        {/* Flow tabs */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {flows.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <button onClick={() => setActiveFlow(f.id)}
                style={{ padding: '7px 14px', borderRadius: activeFlow === f.id ? '10px 0 0 10px' : 10, border: '1px solid ' + (activeFlow === f.id ? 'rgba(13,148,136,0.5)' : 'rgba(255,255,255,0.1)'), borderRight: activeFlow === f.id ? 'none' : undefined, background: activeFlow === f.id ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.03)', color: activeFlow === f.id ? '#5eead4' : 'rgba(255,255,255,0.5)', fontWeight: activeFlow === f.id ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
                {f.name}
              </button>
              {activeFlow === f.id && (
                <button onClick={() => deleteFlow(f.id)}
                  style={{ padding: '7px 8px', borderRadius: '0 10px 10px 0', border: '1px solid rgba(248,113,113,0.25)', borderLeft: 'none', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>×</button>
              )}
            </div>
          ))}
          {creating ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newFlowName} onChange={(e) => setNewFlowName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createFlow()}
                placeholder="Flow adı..." autoFocus
                style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(13,148,136,0.4)', background: 'rgba(13,148,136,0.08)', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none', width: 140 }} />
              <button onClick={createFlow} style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>+</button>
              <button onClick={() => setCreating(false)} style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>×</button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)}
              style={{ padding: '7px 14px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>
              + Yeni
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      {current ? (
        <FlowCanvas flow={current} onChange={updateFlow} />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
          Yukarıdan bir flow seç veya yeni oluştur
        </div>
      )}
    </div>
  );
}

// ── FlowCanvas ────────────────────────────────────────────────────────────────
const NODE_W = 180;
const NODE_H = 90;

function FlowCanvas({ flow, onChange }: { flow: Flow; onChange: (f: Flow) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null); // source node id
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [editNode, setEditNode] = useState<FlowNode | null>(null);

  // ESC → connecting iptal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setConnecting(null); setShowPicker(false); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Drag node ──
  const onNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (connecting) {
      // finish connection
      if (connecting !== id && !flow.edges.some((ed) => ed.from === connecting && ed.to === id)) {
        onChange({ ...flow, edges: [...flow.edges, { from: connecting, to: id }] });
      }
      setConnecting(null);
      return;
    }
    setSelected(id);
    const node = flow.nodes.find((n) => n.id === id)!;
    setDragging({ id, ox: e.clientX - node.x, oy: e.clientY - node.y });
  }, [connecting, flow, onChange]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const nx = e.clientX - dragging.ox;
      const ny = e.clientY - dragging.oy;
      onChange({ ...flow, nodes: flow.nodes.map((n) => n.id === dragging.id ? { ...n, x: Math.max(0, nx), y: Math.max(0, ny) } : n) });
    }
    if (panStart) {
      setCanvasOffset({ x: panStart.ox + e.clientX - panStart.mx, y: panStart.oy + e.clientY - panStart.my });
    }
  }, [dragging, panStart, flow, onChange]);

  const onMouseUp = useCallback(() => { setDragging(null); setPanStart(null); }, []);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (connecting) { setConnecting(null); return; }
    setSelected(null);
    setPanStart({ mx: e.clientX, my: e.clientY, ox: canvasOffset.x, oy: canvasOffset.y });
  }, [connecting, canvasOffset]);

  function addNode(preset: typeof AGENT_PRESETS[0]) {
    const id = 'n' + Date.now();
    const node: FlowNode = {
      id, role: preset.role, label: preset.label, icon: preset.icon,
      color: preset.color, action: '', waitForApproval: false,
      x: 80 + flow.nodes.length * 220, y: 160,
    };
    onChange({ ...flow, nodes: [...flow.nodes, node] });
    setShowPicker(false);
  }

  function addCustomNode() {
    const id = 'n' + Date.now();
    const node: FlowNode = {
      id, role: 'custom', label: 'Yeni Agent', icon: '🤖', color: '#5eead4',
      action: '', waitForApproval: false,
      x: 80 + flow.nodes.length * 220, y: 160,
    };
    onChange({ ...flow, nodes: [...flow.nodes, node] });
    setShowPicker(false);
    setEditNode(node);
  }

  function deleteNode(id: string) {
    onChange({
      ...flow,
      nodes: flow.nodes.filter((n) => n.id !== id),
      edges: flow.edges.filter((e) => e.from !== id && e.to !== id),
    });
    setSelected(null);
  }

  function deleteEdge(from: string, to: string) {
    onChange({ ...flow, edges: flow.edges.filter((e) => !(e.from === from && e.to === to)) });
  }

  function updateNode(patch: Partial<FlowNode>) {
    if (!editNode) return;
    const updated = { ...editNode, ...patch };
    setEditNode(updated);
    onChange({ ...flow, nodes: flow.nodes.map((n) => n.id === updated.id ? updated : n) });
  }

  // Edge path between two nodes
  function edgePath(from: FlowNode, to: FlowNode) {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }

  const canvasW = Math.max(900, ...flow.nodes.map((n) => n.x + NODE_W + 80));
  const canvasH = Math.max(400, ...flow.nodes.map((n) => n.y + NODE_H + 80));

  return (
    <div style={{ flex: 1, display: 'flex', gap: 0, minHeight: 0, borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', background: 'rgba(3,7,18,0.6)', position: 'relative' }}>

      {/* Left toolbar */}
      <div style={{ width: 52, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 8, background: 'rgba(0,0,0,0.2)' }}>
        <ToolBtn title="Node Ekle" onClick={() => setShowPicker(true)}>+</ToolBtn>
        <ToolBtn title="Bağlantı Modu" active={!!connecting} onClick={() => setConnecting(connecting ? null : 'pending')}>⟶</ToolBtn>
        <div style={{ flex: 1 }} />
        <ToolBtn title="Sıfırla" onClick={() => setCanvasOffset({ x: 0, y: 0 })}>⊙</ToolBtn>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: connecting ? 'crosshair' : panStart ? 'grabbing' : 'grab' }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseDown={onCanvasMouseDown}>

        {/* Grid dots */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${canvasOffset.x % 28},${canvasOffset.y % 28})`}>
              <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* SVG edges */}
        <svg ref={svgRef} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
          width={canvasW} height={canvasH}>
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="rgba(94,234,212,0.7)" />
            </marker>
          </defs>
          <g transform={`translate(${canvasOffset.x},${canvasOffset.y})`}>
            {flow.edges.map((edge) => {
              const from = flow.nodes.find((n) => n.id === edge.from);
              const to   = flow.nodes.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              const midX = (from.x + NODE_W + to.x) / 2;
              const midY = (from.y + to.y + NODE_H) / 2;
              return (
                <g key={edge.from + '-' + edge.to} style={{ pointerEvents: 'all' }}>
                  <path d={edgePath(from, to)} fill="none" stroke="rgba(94,234,212,0.25)" strokeWidth={2} markerEnd="url(#arrow)" />
                  {/* invisible wider hit area */}
                  <path d={edgePath(from, to)} fill="none" stroke="transparent" strokeWidth={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); deleteEdge(edge.from, edge.to); }} />
                  {/* delete dot */}
                  <circle cx={midX} cy={midY} r={7} fill="rgba(8,14,30,0.9)" stroke="rgba(248,113,113,0.4)" strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); deleteEdge(edge.from, edge.to); }} />
                  <text x={midX} y={midY + 4} textAnchor="middle" fontSize={9} fill="#f87171" style={{ pointerEvents: 'none', userSelect: 'none' }}>×</text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Nodes */}
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${canvasOffset.x}px,${canvasOffset.y}px)` }}>
          {flow.nodes.map((node, idx) => (
            <FlowNodeCard
              key={node.id}
              node={node}
              index={idx}
              selected={selected === node.id}
              connecting={!!connecting}
              onMouseDown={(e) => onNodeMouseDown(e, node.id)}
              onConnect={() => setConnecting(node.id)}
              onEdit={() => setEditNode(node)}
              onDelete={() => deleteNode(node.id)}
            />
          ))}
        </div>

        {/* Empty state */}
        {flow.nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 40, opacity: 0.08, marginBottom: 12 }}>⟳</div>
            <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>Sol araç çubuğundan + ile node ekle</div>
          </div>
        )}

        {/* Connecting hint */}
        {connecting && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', padding: '6px 16px', borderRadius: 999, background: 'rgba(13,148,136,0.2)', border: '1px solid rgba(13,148,136,0.4)', color: '#5eead4', fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>
            Bağlanacak node'a tıkla — ESC ile iptal
          </div>
        )}
      </div>

      {/* Node picker panel */}
      {showPicker && (
        <div style={{ position: 'absolute', left: 60, top: 12, zIndex: 100, borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(8,14,30,0.98)', padding: 16, width: 220, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 10 }}>Agent Ekle</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {AGENT_PRESETS.map((p) => (
              <button key={p.role} onClick={() => addNode(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid ' + p.color + '30', background: p.color + '0a', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{p.label}</span>
              </button>
            ))}
            <button onClick={addCustomNode}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Custom Agent</span>
            </button>
          </div>
          <button onClick={() => setShowPicker(false)}
            style={{ marginTop: 10, width: '100%', padding: '7px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer' }}>
            Kapat
          </button>
        </div>
      )}

      {/* Node edit panel */}
      {editNode && (
        <NodeEditPanel
          node={editNode}
          onChange={updateNode}
          onClose={() => setEditNode(null)}
        />
      )}
    </div>
  );
}

// ── FlowNodeCard ──────────────────────────────────────────────────────────────
function FlowNodeCard({ node, index, selected, connecting, onMouseDown, onConnect, onEdit, onDelete }: {
  node: FlowNode; index: number; selected: boolean; connecting: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onConnect: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x, top: node.y,
        width: NODE_W, height: NODE_H,
        borderRadius: 16,
        border: '2px solid ' + (selected ? node.color : hovered ? node.color + '60' : 'rgba(255,255,255,0.1)'),
        background: selected ? node.color + '14' : 'rgba(8,14,30,0.95)',
        boxShadow: selected ? '0 0 24px ' + node.color + '30' : hovered ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
        cursor: connecting ? 'crosshair' : 'grab',
        userSelect: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        overflow: 'visible',
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Step number */}
      <div style={{ position: 'absolute', top: -10, left: 12, width: 20, height: 20, borderRadius: '50%', background: node.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
        {index + 1}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 14px 10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{node.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</div>
            <div style={{ fontSize: 10, color: node.color, fontWeight: 600, marginTop: 1 }}>{node.role}</div>
          </div>
        </div>
        {node.action && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>{node.action}</div>
        )}
        {node.waitForApproval && (
          <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>⏸ Onay bekler</div>
        )}
      </div>

      {/* Right connector dot */}
      <div
        title="Bağlantı başlat"
        onClick={(e) => { e.stopPropagation(); onConnect(); }}
        style={{
          position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: node.color, border: '2px solid rgba(8,14,30,0.9)',
          cursor: 'crosshair', zIndex: 10,
          opacity: hovered || selected ? 1 : 0,
          transition: 'opacity 0.15s',
          boxShadow: '0 0 8px ' + node.color,
        }}
      />

      {/* Left connector dot */}
      <div style={{
        position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
        width: 16, height: 16, borderRadius: '50%',
        background: 'rgba(8,14,30,0.9)', border: '2px solid ' + node.color,
        zIndex: 10, opacity: hovered || selected ? 1 : 0, transition: 'opacity 0.15s',
      }} />

      {/* Action buttons */}
      {(hovered || selected) && (
        <div style={{ position: 'absolute', top: -10, right: 8, display: 'flex', gap: 4 }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(8,14,30,0.95)', color: 'rgba(255,255,255,0.6)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✎</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(8,14,30,0.95)', color: '#f87171', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}
    </div>
  );
}

// ── NodeEditPanel ─────────────────────────────────────────────────────────────
const ICON_OPTIONS = ['🤖','👔','📋','🧑‍💻','⚡','🔍','🚀','🛠','🧪','🔧','📊','💡','🎯','⚙️','🔐'];
const COLOR_OPTIONS = ['#38bdf8','#22c55e','#a78bfa','#f59e0b','#f472b6','#fb923c','#5eead4','#0d9488','#7c3aed','#e11d48'];

function NodeEditPanel({ node, onChange, onClose }: {
  node: FlowNode; onChange: (p: Partial<FlowNode>) => void; onClose: () => void;
}) {
  return (
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, borderLeft: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,14,30,0.98)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <div style={{ height: 2, background: 'linear-gradient(90deg, ' + node.color + ', #7c3aed)' }} />
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>Node Düzenle</span>
        <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Label */}
        <div>
          <label style={pLbl}>İsim</label>
          <input value={node.label} onChange={(e) => onChange({ label: e.target.value })}
            style={pInp} />
        </div>

        {/* Role */}
        <div>
          <label style={pLbl}>Rol</label>
          <input value={node.role} onChange={(e) => onChange({ role: e.target.value })}
            placeholder="developer, pm, custom..." style={pInp} />
        </div>

        {/* Icon */}
        <div>
          <label style={pLbl}>İkon</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ICON_OPTIONS.map((ic) => (
              <button key={ic} onClick={() => onChange({ icon: ic })}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid ' + (node.icon === ic ? node.color : 'rgba(255,255,255,0.1)'), background: node.icon === ic ? node.color + '20' : 'rgba(255,255,255,0.03)', fontSize: 16, cursor: 'pointer' }}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label style={pLbl}>Renk</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLOR_OPTIONS.map((c) => (
              <button key={c} onClick={() => onChange({ color: c })}
                style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: '3px solid ' + (node.color === c ? '#fff' : 'transparent'), cursor: 'pointer' }} />
            ))}
          </div>
        </div>

        {/* Action */}
        <div>
          <label style={pLbl}>Görev</label>
          <textarea value={node.action} onChange={(e) => onChange({ action: e.target.value })}
            placeholder="Bu agent ne yapacak?" rows={3}
            style={{ ...pInp, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Wait for approval */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div onClick={() => onChange({ waitForApproval: !node.waitForApproval })}
            style={{ width: 36, height: 20, borderRadius: 999, background: node.waitForApproval ? '#f59e0b' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: node.waitForApproval ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Onay bekle</span>
        </label>
      </div>
    </div>
  );
}

// ── ToolBtn ───────────────────────────────────────────────────────────────────
function ToolBtn({ children, onClick, title, active }: {
  children: React.ReactNode; onClick: () => void; title?: string; active?: boolean;
}) {
  return (
    <button title={title} onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid ' + (active ? 'rgba(13,148,136,0.5)' : 'rgba(255,255,255,0.1)'), background: active ? 'rgba(13,148,136,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#5eead4' : 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
      {children}
    </button>
  );
}

const pLbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 6 };
const pInp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
