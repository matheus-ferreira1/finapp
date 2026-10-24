import { useTranslation } from 'react-i18next'
import { Button, TextInput } from '../../components/ui'
import { parseYear } from '../../lib/month'

export default function YearNav({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => onChange(year - 1)} aria-label={t('summary.previous')}>
        ‹
      </Button>
      {/* Uncontrolled and keyed by the year, so typing 2, 20, 202 does not navigate before 2026 is complete. */}
      <TextInput
        key={year}
        type="number"
        aria-label={t('summary.year')}
        className="w-24 text-center tabular-nums"
        defaultValue={year}
        onChange={(e) => {
          const typed = parseYear(e.target.value)
          if (typed !== null) onChange(typed)
        }}
      />
      <Button onClick={() => onChange(year + 1)} aria-label={t('summary.next')}>
        ›
      </Button>
    </div>
  )
}
