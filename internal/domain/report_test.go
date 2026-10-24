package domain_test

import (
	"testing"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func on(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

type txOpt func(*domain.Transaction)

func confirmed() txOpt { return func(t *domain.Transaction) { t.Confirmed = true } }

func split(percent int) txOpt {
	return func(t *domain.Transaction) { t.SplitRule = &domain.SplitRule{Name: "r", MyPercent: percent} }
}

func inCategory(id int64) txOpt { return func(t *domain.Transaction) { t.CategoryID = &id } }

func newTx(date time.Time, typ domain.TransactionType, amount domain.Money, opts ...txOpt) domain.Transaction {
	tx := domain.Transaction{Date: date, Type: typ, Amount: amount}
	if typ != domain.Settlement {
		tx.CategoryID = ptr(int64(1))
	}
	for _, opt := range opts {
		opt(&tx)
	}
	return tx
}

func TestMonthlySummaries(t *testing.T) {
	txs := []domain.Transaction{
		newTx(on(2026, time.January, 5), domain.Income, 500000, confirmed()),
		newTx(on(2026, time.January, 10), domain.Expense, 20000, split(50), confirmed()),
		newTx(on(2026, time.January, 12), domain.Expense, 10000), // planned only, all mine
		newTx(on(2026, time.January, 20), domain.Settlement, 4000, confirmed()),
		newTx(on(2026, time.February, 1), domain.Expense, 6000, split(50), confirmed()),
		newTx(on(2025, time.December, 15), domain.Expense, 8000, split(50), confirmed()), // previous year
		newTx(on(2027, time.January, 1), domain.Expense, 99999),                          // later year
	}

	got := domain.MonthlySummaries(2026, txs)

	jan, feb, mar := got[0], got[1], got[2]

	t.Run("month numbering", func(t *testing.T) {
		if jan.Month != time.January || got[11].Month != time.December {
			t.Fatalf("months = %v..%v, want January..December", jan.Month, got[11].Month)
		}
	})

	t.Run("planned January", func(t *testing.T) {
		want := domain.Figures{
			Gross:      domain.Totals{Income: 504000, Expense: 30000}, // income + settlement
			Mine:       domain.Totals{Income: 500000, Expense: 20000}, // 10000 (half of 20000) + 10000
			Shared:     10000,
			Settled:    4000,
			OwedToDate: 10000, // Dec 4000 + Jan 10000 - Jan settlement 4000
		}
		if jan.Planned != want {
			t.Errorf("Planned = %+v, want %+v", jan.Planned, want)
		}
	})

	t.Run("realized January ignores unconfirmed", func(t *testing.T) {
		want := domain.Figures{
			Gross:      domain.Totals{Income: 504000, Expense: 20000},
			Mine:       domain.Totals{Income: 500000, Expense: 10000},
			Shared:     10000,
			Settled:    4000,
			OwedToDate: 10000,
		}
		if jan.Realized != want {
			t.Errorf("Realized = %+v, want %+v", jan.Realized, want)
		}
	})

	t.Run("balance to settle accumulates across months and years", func(t *testing.T) {
		if feb.Planned.OwedToDate != 13000 { // 10000 + 3000 in February
			t.Errorf("February OwedToDate = %d, want 13000", feb.Planned.OwedToDate)
		}
		if mar.Planned.OwedToDate != 13000 { // empty month carries the balance
			t.Errorf("March OwedToDate = %d, want 13000", mar.Planned.OwedToDate)
		}
	})

	t.Run("balances", func(t *testing.T) {
		if b := jan.Planned.Gross.Balance(); b != 474000 {
			t.Errorf("gross balance = %d, want 474000", b)
		}
		if b := jan.Planned.Mine.Balance(); b != 480000 {
			t.Errorf("mine balance = %d, want 480000", b)
		}
		if o := jan.Planned.Owed(); o != 6000 {
			t.Errorf("monthly owed = %d, want 6000", o)
		}
	})

	t.Run("empty month", func(t *testing.T) {
		if (mar.Planned.Gross != domain.Totals{}) || (mar.Realized.Mine != domain.Totals{}) {
			t.Errorf("March should have no totals, got %+v", mar)
		}
	})
}

func TestCategoryReport(t *testing.T) {
	categories := []domain.Category{
		{ID: 1, Name: "Housing", Kind: domain.Expense},
		{ID: 2, Name: "Food", Kind: domain.Expense},
		{ID: 3, Name: "Unused", Kind: domain.Expense},
		{ID: 4, Name: "Salary", Kind: domain.Income},
	}
	txs := []domain.Transaction{
		newTx(on(2026, time.January, 1), domain.Expense, 100000, inCategory(1), split(50), confirmed()),
		newTx(on(2026, time.January, 9), domain.Expense, 5000, inCategory(2)),
		newTx(on(2026, time.March, 9), domain.Expense, 7000, inCategory(2), confirmed()),
		newTx(on(2026, time.March, 10), domain.Income, 900000, inCategory(4), confirmed()),
		newTx(on(2026, time.March, 11), domain.Settlement, 50000, confirmed()),
		newTx(on(2025, time.March, 9), domain.Expense, 1234, inCategory(2)), // other year
	}

	tests := []struct {
		name  string
		view  domain.View
		scope domain.Scope
		want  map[string][]domain.Money // category -> [jan, mar, total]
	}{
		{"gross, all", domain.Gross, domain.AllTransactions, map[string][]domain.Money{
			"Housing": {100000, 0, 100000}, "Food": {5000, 7000, 12000}, "Unused": {0, 0, 0},
		}},
		{"mine, all", domain.Mine, domain.AllTransactions, map[string][]domain.Money{
			"Housing": {50000, 0, 50000}, "Food": {5000, 7000, 12000}, "Unused": {0, 0, 0},
		}},
		{"gross, confirmed only", domain.Gross, domain.ConfirmedOnly, map[string][]domain.Money{
			"Housing": {100000, 0, 100000}, "Food": {0, 7000, 7000}, "Unused": {0, 0, 0},
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rows := domain.CategoryReport(2026, categories, txs, tt.view, tt.scope)

			if len(rows) != 3 {
				t.Fatalf("rows = %d, want 3 expense categories only", len(rows))
			}
			for i, name := range []string{"Housing", "Food", "Unused"} {
				row := rows[i]
				if row.Category.Name != name {
					t.Fatalf("row %d = %q, want %q (input order)", i, row.Category.Name, name)
				}
				want := tt.want[name]
				got := []domain.Money{row.Months[0], row.Months[2], row.Total}
				for j := range want {
					if got[j] != want[j] {
						t.Errorf("%s: [jan mar total] = %v, want %v", name, got, want)
						break
					}
				}
			}
		})
	}
}
