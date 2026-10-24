import { useTranslation } from 'react-i18next'
import { Button, TextInput } from '../../components/ui'
import { formatMonthYear } from '../../lib/format'
import { isValidMonth, monthParts, shiftMonth } from '../../lib/month'

export default function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const { t } = useTranslation()
  const { year, month: m } = monthParts(month)

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => onChange(shiftMonth(month, -1))} aria-label={t('transactions.previous')}>
        ‹
      </Button>
      <span className="min-w-20 text-center font-medium tabular-nums">{formatMonthYear(year, m)}</span>
      <Button onClick={() => onChange(shiftMonth(month, 1))} aria-label={t('transactions.next')}>
        ›
      </Button>
      <TextInput
        type="month"
        aria-label={t('transactions.month')}
        value={month}
        onChange={(e) => isValidMonth(e.target.value) && onChange(e.target.value)}
      />
    </div>
  )
}
