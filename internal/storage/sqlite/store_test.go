package sqlite

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "finapp.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func ptr[T any](v T) *T { return &v }

func day(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

// fixtures creates one income category, one expense category and a 50/50 rule.
type fixtures struct {
	salary, housing domain.Category
	half            domain.SplitRule
}

func seed(t *testing.T, s *Store) fixtures {
	t.Helper()
	ctx := context.Background()
	f := fixtures{
		salary:  domain.Category{Name: "Salary", Kind: domain.Income},
		housing: domain.Category{Name: "Housing", Kind: domain.Expense},
		half:    domain.SplitRule{Name: "50/50", MyPercent: 50},
	}
	for _, c := range []*domain.Category{&f.salary, &f.housing} {
		if err := s.CreateCategory(ctx, c); err != nil {
			t.Fatalf("CreateCategory(%s) error = %v", c.Name, err)
		}
	}
	if err := s.CreateSplitRule(ctx, &f.half); err != nil {
		t.Fatalf("CreateSplitRule() error = %v", err)
	}
	return f
}

func TestOpenMigratesAndSeedsSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "finapp.db")

	for range 2 { // reopening must not fail or reseed
		s, err := Open(path)
		if err != nil {
			t.Fatalf("Open() error = %v", err)
		}
		got, err := s.Settings(context.Background())
		if err != nil {
			t.Fatalf("Settings() error = %v", err)
		}
		want := map[string]string{"partner_name": "", "currency": "BRL", "locale": "pt-BR"}
		if len(got) != len(want) {
			t.Fatalf("Settings() = %v, want %v", got, want)
		}
		for k, v := range want {
			if got[k] != v {
				t.Errorf("Settings()[%q] = %q, want %q", k, got[k], v)
			}
		}
		_ = s.Close()
	}
}

func TestOpenFailsInUnwritableDirectory(t *testing.T) {
	if _, err := Open(filepath.Join(t.TempDir(), "missing", "finapp.db")); err == nil {
		t.Fatal("Open() error = nil, want error for a directory that does not exist")
	}
}

func TestSchemaRejectsInvalidRows(t *testing.T) {
	s := newStore(t)
	f := seed(t, s)
	ctx := context.Background()

	exec := func(query string, args ...any) error {
		_, err := s.db.ExecContext(ctx, query, args...)
		return err
	}
	insert := func(cols, vals string, args ...any) error {
		return exec("INSERT INTO transactions ("+cols+") VALUES ("+vals+")", args...)
	}

	if err := insert("date, type, category_id, amount_cents", "?, ?, ?, ?", "2026-01-01", "expense", f.housing.ID, 100); err != nil {
		t.Fatalf("a valid row was rejected: %v", err)
	}

	tests := []struct {
		name string
		cols string
		vals string
		args []any
	}{
		{"settlement with category", "date, type, category_id, amount_cents", "?, ?, ?, ?", []any{"2026-01-01", "settlement", f.housing.ID, 100}},
		{"settlement with split rule", "date, type, split_rule_id, amount_cents", "?, ?, ?, ?", []any{"2026-01-01", "settlement", f.half.ID, 100}},
		{"expense without category", "date, type, amount_cents", "?, ?, ?", []any{"2026-01-01", "expense", 100}},
		{"split rule on income", "date, type, category_id, split_rule_id, amount_cents", "?, ?, ?, ?, ?", []any{"2026-01-01", "income", f.salary.ID, f.half.ID, 100}},
		{"zero amount", "date, type, category_id, amount_cents", "?, ?, ?, ?", []any{"2026-01-01", "expense", f.housing.ID, 0}},
		{"unknown type", "date, type, category_id, amount_cents", "?, ?, ?, ?", []any{"2026-01-01", "gift", f.housing.ID, 100}},
		{"malformed date", "date, type, category_id, amount_cents", "?, ?, ?, ?", []any{"01/01/2026", "expense", f.housing.ID, 100}},
		{"installment number without total", "date, type, category_id, amount_cents, installment_number", "?, ?, ?, ?, ?", []any{"2026-01-01", "expense", f.housing.ID, 100, 2}},
		{"installment above total", "date, type, category_id, amount_cents, installment_number, installment_total", "?, ?, ?, ?, ?, ?", []any{"2026-01-01", "expense", f.housing.ID, 100, 13, 12}},
		{"unknown category", "date, type, category_id, amount_cents", "?, ?, ?, ?", []any{"2026-01-01", "expense", 9999, 100}},
		{"malformed recurrence month", "date, type, category_id, amount_cents, recurrence_month", "?, ?, ?, ?, ?", []any{"2026-01-01", "expense", f.housing.ID, 100, "11/2026"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := insert(tt.cols, tt.vals, tt.args...); err == nil {
				t.Fatal("insert succeeded, want constraint error")
			}
		})
	}

	t.Run("recurrence with split rule on income", func(t *testing.T) {
		err := exec(`INSERT INTO recurrences (day, description, type, category_id, estimated_amount_cents, split_rule_id)
			VALUES (5, 'Salary', 'income', ?, 100, ?)`, f.salary.ID, f.half.ID)
		if err == nil {
			t.Fatal("insert succeeded, want constraint error")
		}
	})
}

func TestCategories(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()

	food := domain.Category{Name: "Food", Kind: domain.Expense}
	if err := s.CreateCategory(ctx, &food); err != nil || food.ID == 0 {
		t.Fatalf("CreateCategory() id = %d, error = %v", food.ID, err)
	}

	t.Run("same name in another kind is allowed", func(t *testing.T) {
		if err := s.CreateCategory(ctx, &domain.Category{Name: "Food", Kind: domain.Income}); err != nil {
			t.Fatalf("error = %v", err)
		}
	})

	t.Run("duplicate name and kind", func(t *testing.T) {
		err := s.CreateCategory(ctx, &domain.Category{Name: "Food", Kind: domain.Expense})
		if !errors.Is(err, domain.ErrDuplicate) {
			t.Fatalf("error = %v, want ErrDuplicate", err)
		}
	})

	t.Run("archived are hidden unless requested", func(t *testing.T) {
		food.Name, food.Archived = "Groceries", true
		if err := s.UpdateCategory(ctx, food); err != nil {
			t.Fatalf("UpdateCategory() error = %v", err)
		}
		active, _ := s.ListCategories(ctx, false)
		all, _ := s.ListCategories(ctx, true)
		if len(active) != 1 || len(all) != 2 {
			t.Fatalf("active = %d, all = %d, want 1 and 2", len(active), len(all))
		}
		if all[0].Name != "Food" || all[1].Name != "Groceries" || !all[1].Archived || all[1].Kind != domain.Expense {
			t.Errorf("all = %+v, want Food then archived expense Groceries (ordered by name)", all)
		}
	})

	t.Run("update unknown", func(t *testing.T) {
		if err := s.UpdateCategory(ctx, domain.Category{ID: 9999, Name: "x", Kind: domain.Expense}); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("error = %v, want ErrNotFound", err)
		}
	})
}

func TestSplitRules(t *testing.T) {
	s := newStore(t)
	f := seed(t, s)
	ctx := context.Background()

	t.Run("duplicate name", func(t *testing.T) {
		if err := s.CreateSplitRule(ctx, &domain.SplitRule{Name: "50/50", MyPercent: 40}); !errors.Is(err, domain.ErrDuplicate) {
			t.Fatalf("error = %v, want ErrDuplicate", err)
		}
	})

	t.Run("percent can change while unused", func(t *testing.T) {
		r := domain.SplitRule{Name: "30/70", MyPercent: 30}
		_ = s.CreateSplitRule(ctx, &r)
		r.MyPercent = 35
		if err := s.UpdateSplitRule(ctx, r); err != nil {
			t.Fatalf("error = %v", err)
		}
	})

	t.Run("percent is frozen once a transaction uses it", func(t *testing.T) {
		tx := domain.Transaction{Date: day(2026, 1, 1), Type: domain.Expense, CategoryID: &f.housing.ID, Amount: 100, SplitRule: &f.half}
		if err := s.CreateTransaction(ctx, &tx); err != nil {
			t.Fatalf("CreateTransaction() error = %v", err)
		}
		changed := f.half
		changed.MyPercent = 60
		if err := s.UpdateSplitRule(ctx, changed); !errors.Is(err, domain.ErrSplitRuleInUse) {
			t.Fatalf("error = %v, want ErrSplitRuleInUse", err)
		}

		renamed := f.half
		renamed.Name, renamed.Archived = "Half", true
		if err := s.UpdateSplitRule(ctx, renamed); err != nil {
			t.Fatalf("renaming and archiving an in-use rule failed: %v", err)
		}
		rules, _ := s.ListSplitRules(ctx, false)
		for _, r := range rules {
			if r.ID == f.half.ID {
				t.Error("archived rule is still listed as active")
			}
		}
	})

	t.Run("percent is frozen once a recurrence uses it", func(t *testing.T) {
		r := domain.SplitRule{Name: "20/80", MyPercent: 20}
		_ = s.CreateSplitRule(ctx, &r)
		rec := domain.Recurrence{Day: 5, Description: "Rent", Type: domain.Expense, CategoryID: f.housing.ID, EstimatedAmount: 100, SplitRule: &r, Active: true}
		if err := s.CreateRecurrence(ctx, &rec); err != nil {
			t.Fatalf("CreateRecurrence() error = %v", err)
		}
		r.MyPercent = 25
		if err := s.UpdateSplitRule(ctx, r); !errors.Is(err, domain.ErrSplitRuleInUse) {
			t.Fatalf("error = %v, want ErrSplitRuleInUse", err)
		}
	})
}

func TestTransactions(t *testing.T) {
	s := newStore(t)
	f := seed(t, s)
	ctx := context.Background()

	rent := domain.Transaction{
		Date: day(2026, 3, 31), Description: "Rent", Type: domain.Expense, CategoryID: &f.housing.ID,
		Amount: 150000, SplitRule: &f.half, InstallmentNumber: ptr(2), InstallmentTotal: ptr(12), Confirmed: true,
	}
	settlement := domain.Transaction{Date: day(2026, 3, 31), Type: domain.Settlement, Amount: 75000}
	salary := domain.Transaction{Date: day(2026, 4, 1), Description: "Salary", Type: domain.Income, CategoryID: &f.salary.ID, Amount: 900000}
	earlier := domain.Transaction{Date: day(2026, 3, 1), Type: domain.Expense, CategoryID: &f.housing.ID, Amount: 1000}
	for _, tx := range []*domain.Transaction{&rent, &settlement, &salary, &earlier} {
		if err := s.CreateTransaction(ctx, tx); err != nil || tx.ID == 0 {
			t.Fatalf("CreateTransaction(%q) id = %d, error = %v", tx.Description, tx.ID, err)
		}
	}

	t.Run("get round trips every field", func(t *testing.T) {
		got, err := s.GetTransaction(ctx, rent.ID)
		if err != nil {
			t.Fatalf("error = %v", err)
		}
		if !got.Date.Equal(rent.Date) || got.Description != "Rent" || got.Type != domain.Expense || got.Amount != 150000 || !got.Confirmed {
			t.Errorf("got %+v", got)
		}
		if got.CategoryID == nil || *got.CategoryID != f.housing.ID {
			t.Errorf("CategoryID = %v, want %d", got.CategoryID, f.housing.ID)
		}
		if got.SplitRule == nil || got.SplitRule.ID != f.half.ID || got.SplitRule.MyPercent != 50 {
			t.Errorf("SplitRule = %+v, want the 50/50 rule", got.SplitRule)
		}
		if got.InstallmentNumber == nil || *got.InstallmentNumber != 2 || *got.InstallmentTotal != 12 {
			t.Errorf("installment = %v/%v, want 2/12", got.InstallmentNumber, got.InstallmentTotal)
		}
	})

	t.Run("settlement has no category or rule", func(t *testing.T) {
		got, _ := s.GetTransaction(ctx, settlement.ID)
		if got.CategoryID != nil || got.SplitRule != nil {
			t.Errorf("got %+v, want no category and no rule", got)
		}
	})

	t.Run("list by month is bounded and ordered by date then id", func(t *testing.T) {
		got, err := s.ListTransactionsByMonth(ctx, domain.YearMonth{Year: 2026, Month: time.March})
		if err != nil {
			t.Fatalf("error = %v", err)
		}
		ids := []int64{earlier.ID, rent.ID, settlement.ID}
		if len(got) != len(ids) {
			t.Fatalf("got %d transactions, want %d", len(got), len(ids))
		}
		for i, id := range ids {
			if got[i].ID != id {
				t.Errorf("position %d = %d, want %d", i, got[i].ID, id)
			}
		}
	})

	t.Run("list returns everything", func(t *testing.T) {
		got, _ := s.ListTransactions(ctx)
		if len(got) != 4 {
			t.Fatalf("got %d, want 4", len(got))
		}
	})

	t.Run("update", func(t *testing.T) {
		upd := rent
		upd.Description, upd.Amount, upd.Confirmed, upd.SplitRule = "Rent March", 160000, false, nil
		upd.InstallmentNumber, upd.InstallmentTotal = nil, nil
		if err := s.UpdateTransaction(ctx, upd); err != nil {
			t.Fatalf("error = %v", err)
		}
		got, _ := s.GetTransaction(ctx, rent.ID)
		if got.Description != "Rent March" || got.Amount != 160000 || got.Confirmed || got.SplitRule != nil || got.InstallmentNumber != nil {
			t.Errorf("got %+v", got)
		}
	})

	t.Run("delete and not found", func(t *testing.T) {
		if err := s.DeleteTransaction(ctx, earlier.ID); err != nil {
			t.Fatalf("DeleteTransaction() error = %v", err)
		}
		if _, err := s.GetTransaction(ctx, earlier.ID); !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("Get after delete error = %v, want ErrNotFound", err)
		}
		if err := s.DeleteTransaction(ctx, earlier.ID); !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("second delete error = %v, want ErrNotFound", err)
		}
		if err := s.UpdateTransaction(ctx, domain.Transaction{ID: 9999, Date: day(2026, 1, 1), Type: domain.Settlement, Amount: 1}); !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("update unknown error = %v, want ErrNotFound", err)
		}
	})
}

func TestRecurrencesAndGeneratedTransactions(t *testing.T) {
	s := newStore(t)
	f := seed(t, s)
	ctx := context.Background()
	november := domain.YearMonth{Year: 2026, Month: time.November}

	rec := domain.Recurrence{Day: 31, Description: "Electricity", Type: domain.Expense, CategoryID: f.housing.ID, EstimatedAmount: 18000, SplitRule: &f.half, Active: true}
	if err := s.CreateRecurrence(ctx, &rec); err != nil || rec.ID == 0 {
		t.Fatalf("CreateRecurrence() id = %d, error = %v", rec.ID, err)
	}

	t.Run("round trip", func(t *testing.T) {
		got, err := s.ListRecurrences(ctx)
		if err != nil || len(got) != 1 {
			t.Fatalf("ListRecurrences() = %v, error = %v", got, err)
		}
		r := got[0]
		if r.Day != 31 || r.Description != "Electricity" || r.Type != domain.Expense || r.CategoryID != f.housing.ID ||
			r.EstimatedAmount != 18000 || !r.Active || r.SplitRule == nil || r.SplitRule.MyPercent != 50 {
			t.Errorf("got %+v", r)
		}
	})

	t.Run("update", func(t *testing.T) {
		upd := rec
		upd.EstimatedAmount, upd.Active, upd.SplitRule = 20000, false, nil
		if err := s.UpdateRecurrence(ctx, upd); err != nil {
			t.Fatalf("error = %v", err)
		}
		got, _ := s.ListRecurrences(ctx)
		if got[0].EstimatedAmount != 20000 || got[0].Active || got[0].SplitRule != nil {
			t.Errorf("got %+v", got[0])
		}
	})

	generated, _ := domain.GenerateRecurring([]domain.Recurrence{rec}, nil, november)
	tx := generated[0]
	if err := s.CreateTransaction(ctx, &tx); err != nil {
		t.Fatalf("CreateTransaction() error = %v", err)
	}

	t.Run("generated transaction keeps its link even if its date is edited", func(t *testing.T) {
		moved := tx
		moved.Date = day(2026, 12, 2)
		if err := s.UpdateTransaction(ctx, moved); err != nil {
			t.Fatalf("error = %v", err)
		}
		got, err := s.ListGeneratedFor(ctx, november)
		if err != nil || len(got) != 1 {
			t.Fatalf("ListGeneratedFor() = %v, error = %v", got, err)
		}
		if got[0].Recurrence == nil || got[0].Recurrence.ID != rec.ID || got[0].Recurrence.Month != november {
			t.Errorf("Recurrence = %+v, want link to %d in %s", got[0].Recurrence, rec.ID, november)
		}
	})

	t.Run("a recurrence generates one transaction per month", func(t *testing.T) {
		dup := tx
		dup.ID = 0
		if err := s.CreateTransaction(ctx, &dup); !errors.Is(err, domain.ErrDuplicate) {
			t.Fatalf("error = %v, want ErrDuplicate", err)
		}
	})

	t.Run("deleting a recurrence keeps its transactions unlinked", func(t *testing.T) {
		if err := s.DeleteRecurrence(ctx, rec.ID); err != nil {
			t.Fatalf("DeleteRecurrence() error = %v", err)
		}
		got, err := s.GetTransaction(ctx, tx.ID)
		if err != nil {
			t.Fatalf("transaction was lost: %v", err)
		}
		if got.Recurrence != nil {
			t.Errorf("Recurrence = %+v, want nil", got.Recurrence)
		}
		if err := s.DeleteRecurrence(ctx, rec.ID); !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("second delete error = %v, want ErrNotFound", err)
		}
	})
}

func TestSettings(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()

	if err := s.SetSetting(ctx, "partner_name", "Ana"); err != nil {
		t.Fatalf("SetSetting() error = %v", err)
	}
	got, _ := s.Settings(ctx)
	if got["partner_name"] != "Ana" {
		t.Errorf("partner_name = %q, want Ana", got["partner_name"])
	}
	if err := s.SetSetting(ctx, "unknown_key", "x"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("unknown key error = %v, want ErrNotFound", err)
	}
}
