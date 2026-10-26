package seed_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/domain"
	"github.com/matheus-ferreira1/finapp/internal/seed"
	"github.com/matheus-ferreira1/finapp/internal/storage/sqlite"
)

var ctx = context.Background()

func newService(t *testing.T) *app.Service {
	t.Helper()
	store, err := sqlite.Open(filepath.Join(t.TempDir(), "finapp.db"))
	if err != nil {
		t.Fatalf("sqlite.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return app.New(store)
}

func date(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 12, 0, 0, 0, time.UTC) }

// monthsBack returns the n months ending at now's month, oldest first.
func monthsBack(now time.Time, n int) []domain.YearMonth {
	months := make([]domain.YearMonth, 0, n)
	for i := n - 1; i >= 0; i-- {
		t := time.Date(now.Year(), now.Month()-time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		months = append(months, domain.YearMonth{Year: t.Year(), Month: t.Month()})
	}
	return months
}

func TestRunPopulatesEveryFeature(t *testing.T) {
	svc := newService(t)
	now := date(2026, time.October, 15)

	if err := seed.Run(ctx, svc, now); err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	categories, _ := svc.ListCategories(ctx, true)
	var income, expense, archivedCategories int
	for _, c := range categories {
		switch c.Kind {
		case domain.Income:
			income++
		case domain.Expense:
			expense++
		}
		if c.Archived {
			archivedCategories++
		}
	}
	if income < 2 || expense < 5 || archivedCategories != 1 {
		t.Errorf("categories: income=%d expense=%d archived=%d, want >=2, >=5, 1", income, expense, archivedCategories)
	}

	rules, _ := svc.ListSplitRules(ctx, true)
	var archivedRules int
	for _, r := range rules {
		if r.Archived {
			archivedRules++
		}
	}
	if len(rules) < 3 || archivedRules != 1 {
		t.Errorf("split rules: total=%d archived=%d, want >=3, 1", len(rules), archivedRules)
	}

	recurrences, _ := svc.ListRecurrences(ctx)
	var inactive int
	for _, r := range recurrences {
		if !r.Active {
			inactive++
		}
	}
	if len(recurrences) < 4 || inactive != 1 {
		t.Errorf("recurrences: total=%d inactive=%d, want >=4, 1", len(recurrences), inactive)
	}

	settings, _ := svc.Settings(ctx)
	if settings["partner_name"] == "" {
		t.Error("partner_name is empty, want the partner's name")
	}
}

func TestRunFillsTheLastSixMonths(t *testing.T) {
	svc := newService(t)
	now := date(2026, time.October, 15)
	if err := seed.Run(ctx, svc, now); err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	var all []domain.Transaction
	for _, month := range monthsBack(now, 6) {
		txs, err := svc.ListTransactions(ctx, month)
		if err != nil {
			t.Fatalf("ListTransactions(%s) error = %v", month, err)
		}
		if len(txs) == 0 {
			t.Errorf("month %s has no transactions", month)
		}
		all = append(all, txs...)
	}

	var settlement, installment, shared, unconfirmed, generated bool
	for _, tx := range all {
		settlement = settlement || tx.Type == domain.Settlement
		installment = installment || tx.InstallmentTotal != nil
		shared = shared || (tx.Type == domain.Expense && tx.SplitRule != nil)
		unconfirmed = unconfirmed || !tx.Confirmed
		generated = generated || tx.Recurrence != nil
	}
	for name, ok := range map[string]bool{
		"settlement": settlement, "installment": installment, "shared expense": shared,
		"unconfirmed": unconfirmed, "recurrence-generated": generated,
	} {
		if !ok {
			t.Errorf("no %s transaction was seeded", name)
		}
	}
}

func TestRunConfirmsThePastAndLeavesTheFutureOpen(t *testing.T) {
	svc := newService(t)
	now := date(2026, time.October, 15)
	if err := seed.Run(ctx, svc, now); err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	months := monthsBack(now, 6)
	current := months[len(months)-1]
	for _, month := range months {
		txs, _ := svc.ListTransactions(ctx, month)
		for _, tx := range txs {
			isPast := month != current
			if isPast && !tx.Confirmed {
				t.Errorf("%s %q on %s is unconfirmed, want confirmed in a past month", tx.Type, tx.Description, tx.Date.Format("2006-01-02"))
			}
			if tx.Date.After(now) && tx.Confirmed {
				t.Errorf("%q on %s is confirmed but lies in the future", tx.Description, tx.Date.Format("2006-01-02"))
			}
		}
	}
}

func TestRunRefusesANonEmptyDatabase(t *testing.T) {
	svc := newService(t)
	if _, err := svc.CreateCategory(ctx, domain.Category{Name: "Mine", Kind: domain.Expense}); err != nil {
		t.Fatalf("setup error = %v", err)
	}

	if err := seed.Run(ctx, svc, date(2026, time.October, 15)); err == nil {
		t.Fatal("Run() error = nil, want an error on a database with data")
	}

	categories, _ := svc.ListCategories(ctx, true)
	if len(categories) != 1 {
		t.Errorf("categories = %d after a refused run, want the original 1", len(categories))
	}
}

func TestRunAtMonthBoundaries(t *testing.T) {
	tests := []struct {
		name string
		now  time.Time
	}{
		{"last day of a long month", date(2026, time.January, 31)},
		{"february", date(2026, time.February, 28)},
		{"leap day", date(2028, time.February, 29)},
		{"first day of the year", date(2026, time.January, 1)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := newService(t)
			if err := seed.Run(ctx, svc, tt.now); err != nil {
				t.Fatalf("Run() error = %v", err)
			}
			for _, month := range monthsBack(tt.now, 6) {
				txs, err := svc.ListTransactions(ctx, month)
				if err != nil || len(txs) == 0 {
					t.Errorf("month %s: %d transactions, error = %v", month, len(txs), err)
				}
			}
		})
	}
}
