'use client';

import { useLocale } from '@/lib/i18n';
import ComparisonPage from '../ComparisonPage';

export default function VsMulticaPage() {
  const { t } = useLocale();

  return (
    <ComparisonPage
      slug='multica'
      competitorName='Multica'
      rows={[
        { feature: 'approach', agena: t('vs.multica.approach.agena'), competitor: t('vs.multica.approach.competitor') },
        { feature: 'prCreation', agena: t('vs.multica.pr.agena'), competitor: t('vs.multica.pr.competitor') },
        { feature: 'codeReview', agena: t('vs.multica.review.agena'), competitor: t('vs.multica.review.competitor') },
        { feature: 'multiRepo', agena: t('vs.yes') + ' ' + t('vs.feature.multiRepo'), competitor: t('vs.multica.multiRepo.competitor') },
        { feature: 'dependencies', agena: t('vs.yes') + ' ' + t('vs.feature.dependencies'), competitor: t('vs.multica.dependencies.competitor') },
        { feature: 'sprint', agena: t('vs.yes') + ' Azure/Jira', competitor: t('vs.multica.sprint.competitor') },
        { feature: 'chatops', agena: t('vs.yes') + ' Slack/Teams/Telegram', competitor: t('vs.multica.chatops.competitor') },
        { feature: 'office', agena: t('vs.yes') + ' Pixel Agent', competitor: t('vs.multica.office.competitor') },
        { feature: 'selfHosted', agena: t('vs.yes') + ' Docker Compose', competitor: t('vs.multica.selfHosted.competitor') },
        { feature: 'pricing', agena: t('vs.multica.pricing.agena'), competitor: t('vs.multica.pricing.competitor') },
      ]}
    />
  );
}
