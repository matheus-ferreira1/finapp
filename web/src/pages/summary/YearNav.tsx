import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, TextInput } from '../../components/ui'
import { MAX_YEAR, MIN_YEAR, parseYear } from '../../lib/month'

export default function YearNav({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  const { t } = useTranslation()
  // What is being typed, which may not be a year yet; it only navigates once it is one.
  const [draft, setDraft] = useState(String(year))
  const [shown, setShown] = useState(year)
  if (shown !== year) {
    setShown(year)
    setDraft(String(year))
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => onChange(year - 1)} disabled={year <= MIN_YEAR} aria-label={t('summary.previous')}>
        ‹
      </Button>
      <TextInput
        type="number"
        aria-label={t('summary.year')}
        className="w-24 text-center tabular-nums"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const typed = parseYear(e.target.value)
          if (typed !== null) onChange(typed)
        }}
        onBlur={() => setDraft(String(year))}
      />
      <Button onClick={() => onChange(year + 1)} disabled={year >= MAX_YEAR} aria-label={t('summary.next')}>
        ›
      </Button>
    </div>
  )
}
