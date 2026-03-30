'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, loadPrefs, savePrefs } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const TOTAL_STEPS = 4;

const cardStyle: React.CSSProperties = {
  background: 'var(--glass)',
  backdropFilter: 'blur(20px)',
  border: '1px solid var(--panel-border)',
  borderRadius: 16,
  padding: '40px 36px',
  maxWidth: 560,
  width: '100%',
  margin: '0 auto',
};

const btnPrimary: React.CSSProperties = {
  padding: '12px 32px',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg, #0d9488, #22c55e)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 12,
  border: '1px solid var(--panel-border)',
  background: 'transparent',
  color: 'var(--muted)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--panel-border)',
  background: 'var(--panel-alt, rgba(255,255,255,0.04))',
  color: 'var(--ink)',
  fontSize: 14,
  outline: 'none',
};

function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useLocale();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === current ? 36 : 12,
            height: 6,
            borderRadius: 3,
            background: i + 1 <= current
              ? 'linear-gradient(90deg, #0d9488, #22c55e)'
              : 'var(--panel-border)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
        {t('onboarding.step')} {current}{t('onboarding.of')}{total}
      </span>
    </div>
  );
}

/* ────── Step 1: Welcome ────── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  const { t } = useLocale();
  return (
    <div style={cardStyle}>
      <StepIndicator current={1} total={TOTAL_STEPS} />
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
          {t('onboarding.welcome.title')}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, marginTop: 12, maxWidth: 420, margin: '12px auto 0' }}>
          {t('onboarding.welcome.subtitle')}
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={onNext} style={btnPrimary}>
          {t('onboarding.welcome.start')}
        </button>
      </div>
    </div>
  );
}

/* ────── Step 2: Connect Integration ────── */
function StepIntegration({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { t } = useLocale();
  const [provider, setProvider] = useState<'azure' | 'jira' | null>(null);
  const [azureOrg, setAzureOrg] = useState('');
  const [azureProject, setAzureProject] = useState('');
  const [azurePat, setAzurePat] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (provider === 'azure') {
        await apiFetch('/integrations/azure', {
          method: 'PUT',
          body: JSON.stringify({ base_url: azureOrg, project: azureProject, secret: azurePat }),
        });
      } else if (provider === 'jira') {
        await apiFetch('/integrations/jira', {
          method: 'PUT',
          body: JSON.stringify({ base_url: jiraUrl, username: jiraEmail, secret: jiraToken }),
        });
      }
      setSuccess(t('onboarding.integration.saved'));
      setTimeout(() => onNext(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.integration.failed'));
    } finally {
      setSaving(false);
    }
  }

  const canSave = provider === 'azure'
    ? azureOrg.trim() && azurePat.trim()
    : provider === 'jira'
      ? jiraUrl.trim() && jiraToken.trim()
      : false;

  return (
    <div style={cardStyle}>
      <StepIndicator current={2} total={TOTAL_STEPS} />
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          {t('onboarding.integration.title')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
          {t('onboarding.integration.subtitle')}
        </p>
      </div>

      {/* Provider selection */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
        {(['azure', 'jira'] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setProvider(p); setError(''); setSuccess(''); }}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: provider === p ? '2px solid #0d9488' : '1px solid var(--panel-border)',
              background: provider === p ? 'rgba(13,148,136,0.12)' : 'var(--glass)',
              color: provider === p ? '#0d9488' : 'var(--muted)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {p === 'azure' ? '🔷 ' : '🔵 '}
            {t(`onboarding.integration.${p}`)}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void handleSave(); }}>
        {/* Azure form */}
        {provider === 'azure' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                {t('onboarding.integration.orgUrl')}
              </label>
              <input
                style={inputStyle}
                placeholder={t('onboarding.integration.orgUrlPlaceholder')}
                value={azureOrg}
                onChange={(e) => setAzureOrg(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                {t('onboarding.integration.project')}
              </label>
              <input
                style={inputStyle}
                placeholder={t('onboarding.integration.projectPlaceholder')}
                value={azureProject}
                onChange={(e) => setAzureProject(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                {t('onboarding.integration.pat')}
              </label>
              <input
                style={inputStyle}
                type="password"
                placeholder={t('onboarding.integration.patPlaceholder')}
                value={azurePat}
                onChange={(e) => setAzurePat(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Jira form */}
        {provider === 'jira' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                {t('onboarding.integration.jiraUrl')}
              </label>
              <input
                style={inputStyle}
                placeholder={t('onboarding.integration.jiraUrlPlaceholder')}
                value={jiraUrl}
                onChange={(e) => setJiraUrl(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                {t('onboarding.integration.jiraEmail')}
              </label>
              <input
                style={inputStyle}
                type="email"
                placeholder={t('onboarding.integration.jiraEmailPlaceholder')}
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                {t('onboarding.integration.jiraToken')}
              </label>
              <input
                style={inputStyle}
                type="password"
                placeholder={t('onboarding.integration.jiraTokenPlaceholder')}
                value={jiraToken}
                onChange={(e) => setJiraToken(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: 13 }}>
            {success}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          <button type='button' onClick={onSkip} style={btnSecondary}>
            {t('onboarding.integration.skip')}
          </button>
          {provider && (
            <button
              type='submit'
              disabled={!canSave || saving}
              style={{ ...btnPrimary, opacity: !canSave || saving ? 0.5 : 1 }}
            >
              {saving ? t('onboarding.integration.saving') : t('onboarding.integration.save')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ────── Step 3: Invite Team ────── */
function StepTeam({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function addEmail() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('onboarding.team.invalidEmail'));
      return;
    }
    if (emails.includes(trimmed)) {
      setError(t('onboarding.team.duplicate'));
      return;
    }
    setEmails((prev) => [...prev, trimmed]);
    setEmail('');
    setError('');
  }

  function removeEmail(e: string) {
    setEmails((prev) => prev.filter((x) => x !== e));
  }

  async function sendInvites() {
    if (!emails.length) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      await Promise.all(
        emails.map((e) =>
          apiFetch('/org/invite', {
            method: 'POST',
            body: JSON.stringify({ email: e }),
          })
        )
      );
      setSuccess(t('onboarding.team.sent'));
      setTimeout(() => onNext(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.team.failed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={cardStyle}>
      <StepIndicator current={3} total={TOTAL_STEPS} />
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          {t('onboarding.team.title')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
          {t('onboarding.team.subtitle')}
        </p>
      </div>

      {/* Email input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          type="email"
          placeholder={t('onboarding.team.emailPlaceholder')}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
        />
        <button
          onClick={addEmail}
          style={{
            ...btnPrimary,
            padding: '10px 20px',
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {t('onboarding.team.add')}
        </button>
      </div>

      {/* Email list */}
      {emails.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {emails.map((e) => (
            <span
              key={e}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(13,148,136,0.12)',
                border: '1px solid rgba(13,148,136,0.3)',
                color: '#0d9488',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {e}
              <button
                onClick={() => removeEmail(e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0d9488',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: 13 }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <button onClick={onSkip} style={btnSecondary}>
          {t('onboarding.team.skip')}
        </button>
        {emails.length > 0 && (
          <button
            onClick={sendInvites}
            disabled={sending}
            style={{ ...btnPrimary, opacity: sending ? 0.5 : 1 }}
          >
            {sending ? t('onboarding.team.sending') : t('onboarding.team.send')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ────── Step 4: Done ────── */
function StepDone({ onFinish }: { onFinish: () => void }) {
  const { t } = useLocale();

  const quickLinks = [
    { href: '/dashboard/tasks', label: t('onboarding.done.createTask'), icon: '✅' },
    { href: '/dashboard/agents', label: t('onboarding.done.configureAgents'), icon: '🤖' },
    { href: '/dashboard/office', label: t('onboarding.done.officeView'), icon: '🏢' },
  ];

  return (
    <div style={cardStyle}>
      <StepIndicator current={4} total={TOTAL_STEPS} />
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>
          🎉
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
          {t('onboarding.done.title')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 10 }}>
          {t('onboarding.done.subtitle')}
        </p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          {t('onboarding.done.quickLinks')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quickLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--panel-border)',
                background: 'var(--glass)',
                color: 'var(--ink)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(13,148,136,0.4)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--panel-border)'; }}
            >
              <span style={{ fontSize: 20 }}>{link.icon}</span>
              {link.label}
              <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 16 }}>→</span>
            </a>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={onFinish} style={btnPrimary}>
          {t('onboarding.done.goToDashboard')}
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}

/* ────── Main Onboarding Page ────── */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  async function completeOnboarding() {
    try {
      const prefs = await loadPrefs();
      const currentSettings = (prefs.profile_settings || {}) as Record<string, unknown>;
      await savePrefs({
        profile_settings: { ...currentSettings, onboarding_completed: true },
      });
    } catch {
      // Best-effort; do not block navigation
    }
    router.push('/dashboard');
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 140px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      {step === 1 && <StepWelcome onNext={() => setStep(2)} />}
      {step === 2 && <StepIntegration onNext={() => setStep(3)} onSkip={() => setStep(3)} />}
      {step === 3 && <StepTeam onNext={() => setStep(4)} onSkip={() => setStep(4)} />}
      {step === 4 && <StepDone onFinish={completeOnboarding} />}
    </div>
  );
}
