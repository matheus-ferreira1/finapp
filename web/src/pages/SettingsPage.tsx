import { useTranslation } from 'react-i18next'
import PageHeader from '../components/PageHeader'
import CategorySection from './settings/CategorySection'
import GeneralSettings from './settings/GeneralSettings'
import SplitRuleSection from './settings/SplitRuleSection'

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <GeneralSettings />
      <div className="grid gap-x-10 md:grid-cols-2">
        <CategorySection kind="income" />
        <CategorySection kind="expense" />
      </div>
      <SplitRuleSection />
    </>
  )
}
