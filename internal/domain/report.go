package domain

import "time"

// Totals holds income and expense sums of one view (gross or mine).
type Totals struct {
	Income  Money
	Expense Money
}

func (t Totals) Balance() Money { return t.Income - t.Expense }

// Figures are the monthly sums for one scope (planned or realized).
//
// Gross counts everything that moved: settlements received count as income.
// Mine counts only my part: settlements are ignored and expenses are cut to My().
type Figures struct {
	Gross   Totals
	Mine    Totals
	Shared  Money // part of expenses the partner owes me
	Settled Money // settlements received from the partner
	// OwedToDate is what the partner still owes me at the end of the month,
	// accumulated since the first transaction.
	OwedToDate Money
}

// Owed is the balance to settle for the month alone.
func (f Figures) Owed() Money { return f.Shared - f.Settled }

func (f *Figures) add(tx Transaction) {
	switch tx.Type {
	case Income:
		f.Gross.Income += tx.Amount
		f.Mine.Income += tx.Amount
	case Expense:
		f.Gross.Expense += tx.Amount
		f.Mine.Expense += tx.My()
		f.Shared += tx.Shared()
	case Settlement:
		f.Gross.Income += tx.Amount
		f.Settled += tx.Amount
	}
}

// MonthSummary compares everything planned with what is already confirmed.
type MonthSummary struct {
	Month    time.Month
	Planned  Figures // all transactions
	Realized Figures // confirmed transactions only
}

// MonthlySummaries builds the twelve months of year. Transactions of other
// years are ignored, except that earlier ones feed the cumulative balance.
func MonthlySummaries(year int, txs []Transaction) [12]MonthSummary {
	var months [12]MonthSummary
	for i := range months {
		months[i].Month = time.Month(i + 1)
	}

	var plannedOwed, realizedOwed Money // balance carried from before the year
	for _, tx := range txs {
		switch y := tx.Date.Year(); {
		case y < year:
			owed := tx.Shared()
			if tx.Type == Settlement {
				owed = -tx.Amount
			}
			plannedOwed += owed
			if tx.Confirmed {
				realizedOwed += owed
			}
		case y == year:
			m := &months[tx.Date.Month()-1]
			m.Planned.add(tx)
			if tx.Confirmed {
				m.Realized.add(tx)
			}
		}
	}

	for i := range months {
		plannedOwed += months[i].Planned.Owed()
		realizedOwed += months[i].Realized.Owed()
		months[i].Planned.OwedToDate = plannedOwed
		months[i].Realized.OwedToDate = realizedOwed
	}
	return months
}

// View selects which amount of an expense a report shows.
type View int

const (
	Gross View = iota // the full amount paid
	Mine              // only my part
)

// Scope selects which transactions a report includes.
type Scope int

const (
	AllTransactions Scope = iota
	ConfirmedOnly
)

// CategoryRow is one category of the report with its spending per month.
type CategoryRow struct {
	Category Category
	Months   [12]Money
	Total    Money
}

// CategoryReport sums expenses per expense category and month of year.
// Rows follow the order of categories; income categories are left out.
func CategoryReport(year int, categories []Category, txs []Transaction, view View, scope Scope) []CategoryRow {
	var rows []CategoryRow
	index := make(map[int64]int)
	for _, c := range categories {
		if c.Kind != Expense {
			continue
		}
		index[c.ID] = len(rows)
		rows = append(rows, CategoryRow{Category: c})
	}

	for _, tx := range txs {
		if tx.Type != Expense || tx.CategoryID == nil || tx.Date.Year() != year {
			continue
		}
		if scope == ConfirmedOnly && !tx.Confirmed {
			continue
		}
		i, ok := index[*tx.CategoryID]
		if !ok {
			continue
		}
		amount := tx.Amount
		if view == Mine {
			amount = tx.My()
		}
		rows[i].Months[tx.Date.Month()-1] += amount
		rows[i].Total += amount
	}
	return rows
}
