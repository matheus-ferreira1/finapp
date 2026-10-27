import { Trans } from 'react-i18next'
import { useSettings } from '../../app/settings-context'

/** What came in, what went out and what is left, as one sentence. The word order follows the language. */
export default function HeroSentence({ income, expense, balance }: { income: number; expense: number; balance: number }) {
  const { formatMoney } = useSettings()
  const overspent = balance < 0

  return (
    <p className="max-w-3xl font-display text-4xl leading-tight font-bold tracking-tight md:text-5xl">
      <Trans
        i18nKey={overspent ? 'overview.hero.deficit' : 'overview.hero.surplus'}
        values={{ income: formatMoney(income), expense: formatMoney(expense), balance: formatMoney(Math.abs(balance)) }}
        components={{
          in: <span className="text-income" />,
          out: <span className="text-expense" />,
          left: <span className={overspent ? 'text-expense' : 'text-ink'} />,
        }}
      />
    </p>
  )
}
