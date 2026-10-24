package app_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/domain"
	"github.com/matheus-ferreira1/finapp/internal/storage/sqlite"
)

var ctx = context.Background()

func ptr[T any](v T) *T { return &v }

func day(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

type env struct {
	svc             *app.Service
	salary, housing domain.Category
	half            domain.SplitRule
}

func newEnv(t *testing.T) *env {
	t.Helper()
	store, err := sqlite.Open(filepath.Join(t.TempDir(), "finapp.db"))
	if err != nil {
		t.Fatalf("sqlite.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	e := &env{svc: app.New(store)}
	must := func(c domain.Category, err error) domain.Category {
		t.Helper()
		if err != nil {
			t.Fatalf("setup error = %v", err)
		}
		return c
	}
	e.salary = must(e.svc.CreateCategory(ctx, domain.Category{Name: "Salary", Kind: domain.Income}))
	e.housing = must(e.svc.CreateCategory(ctx, domain.Category{Name: "Housing", Kind: domain.Expense}))
	if e.half, err = e.svc.CreateSplitRule(ctx, domain.SplitRule{Name: "50/50", MyPercent: 50}); err != nil {
		t.Fatalf("setup error = %v", err)
	}
	return e
}

func TestCreateTransaction(t *testing.T) {
	e := newEnv(t)
	base := func(mod func(*domain.Transaction)) domain.Transaction {
		tx := domain.Transaction{Date: day(2026, 11, 3), Description: "Rent", Type: domain.Expense, CategoryID: &e.housing.ID, Amount: 100000}
		mod(&tx)
		return tx
	}

	tests := []struct {
		name    string
		tx      domain.Transaction
		wantErr error
	}{
		{"valid", base(func(*domain.Transaction) {}), nil},
		{"shared expense referencing the rule by id only", base(func(tx *domain.Transaction) { tx.SplitRule = &domain.SplitRule{ID: e.half.ID} }), nil},
		{"income category on an expense", base(func(tx *domain.Transaction) { tx.CategoryID = &e.salary.ID }), domain.ErrCategoryKindMismatch},
		{"unknown category", base(func(tx *domain.Transaction) { tx.CategoryID = ptr(int64(999)) }), domain.ErrUnknownReference},
		{"unknown split rule", base(func(tx *domain.Transaction) { tx.SplitRule = &domain.SplitRule{ID: 999} }), domain.ErrUnknownReference},
		{"missing category", base(func(tx *domain.Transaction) { tx.CategoryID = nil }), domain.ErrCategoryRequired},
		{"settlement with category", base(func(tx *domain.Transaction) { tx.Type = domain.Settlement }), domain.ErrCategoryNotAllowed},
		{"zero amount", base(func(tx *domain.Transaction) { tx.Amount = 0 }), domain.ErrInvalidAmount},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := e.svc.CreateTransaction(ctx, tt.tx)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("error = %v, want %v", err, tt.wantErr)
			}
			if err == nil && got.ID == 0 {
				t.Error("created transaction has no id")
			}
		})
	}

	t.Run("response carries the resolved split rule", func(t *testing.T) {
		got, err := e.svc.CreateTransaction(ctx, base(func(tx *domain.Transaction) { tx.SplitRule = &domain.SplitRule{ID: e.half.ID} }))
		if err != nil {
			t.Fatal(err)
		}
		if got.My() != 50000 || got.Shared() != 50000 {
			t.Errorf("My/Shared = %d/%d, want 50000/50000", got.My(), got.Shared())
		}
	})
}

func TestUpdateTransaction(t *testing.T) {
	e := newEnv(t)
	created, _ := e.svc.CreateTransaction(ctx, domain.Transaction{Date: day(2026, 11, 3), Type: domain.Expense, CategoryID: &e.housing.ID, Amount: 1000})

	t.Run("changes fields", func(t *testing.T) {
		upd := created
		upd.Amount, upd.Confirmed, upd.SplitRule = 2000, true, &domain.SplitRule{ID: e.half.ID}
		got, err := e.svc.UpdateTransaction(ctx, upd)
		if err != nil {
			t.Fatal(err)
		}
		if got.Amount != 2000 || !got.Confirmed || got.SplitRule == nil || got.SplitRule.MyPercent != 50 {
			t.Errorf("got %+v", got)
		}
	})

	t.Run("validates like create", func(t *testing.T) {
		upd := created
		upd.CategoryID = &e.salary.ID
		if _, err := e.svc.UpdateTransaction(ctx, upd); !errors.Is(err, domain.ErrCategoryKindMismatch) {
			t.Fatalf("error = %v, want ErrCategoryKindMismatch", err)
		}
	})

	t.Run("unknown id", func(t *testing.T) {
		upd := created
		upd.ID = 999
		if _, err := e.svc.UpdateTransaction(ctx, upd); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("error = %v, want ErrNotFound", err)
		}
	})

	t.Run("delete", func(t *testing.T) {
		if err := e.svc.DeleteTransaction(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
		if err := e.svc.DeleteTransaction(ctx, created.ID); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("second delete error = %v, want ErrNotFound", err)
		}
	})
}

func TestCategories(t *testing.T) {
	e := newEnv(t)

	t.Run("validates", func(t *testing.T) {
		if _, err := e.svc.CreateCategory(ctx, domain.Category{Name: " ", Kind: domain.Expense}); !errors.Is(err, domain.ErrNameRequired) {
			t.Fatalf("error = %v, want ErrNameRequired", err)
		}
	})

	t.Run("duplicate", func(t *testing.T) {
		if _, err := e.svc.CreateCategory(ctx, domain.Category{Name: "Housing", Kind: domain.Expense}); !errors.Is(err, domain.ErrDuplicate) {
			t.Fatalf("error = %v, want ErrDuplicate", err)
		}
	})

	t.Run("rename and archive", func(t *testing.T) {
		upd := e.housing
		upd.Name, upd.Archived = "Home", true
		got, err := e.svc.UpdateCategory(ctx, upd)
		if err != nil || got.Name != "Home" || !got.Archived {
			t.Fatalf("got %+v, error = %v", got, err)
		}
	})

	t.Run("kind is immutable", func(t *testing.T) {
		upd := e.salary
		upd.Kind = domain.Expense
		if _, err := e.svc.UpdateCategory(ctx, upd); !errors.Is(err, domain.ErrKindImmutable) {
			t.Fatalf("error = %v, want ErrKindImmutable", err)
		}
	})

	t.Run("unknown id", func(t *testing.T) {
		if _, err := e.svc.UpdateCategory(ctx, domain.Category{ID: 999, Name: "x", Kind: domain.Expense}); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("error = %v, want ErrNotFound", err)
		}
	})
}

func TestSplitRules(t *testing.T) {
	e := newEnv(t)

	if _, err := e.svc.CreateSplitRule(ctx, domain.SplitRule{Name: "bad", MyPercent: 120}); !errors.Is(err, domain.ErrInvalidSplitPercent) {
		t.Fatalf("create error = %v, want ErrInvalidSplitPercent", err)
	}

	_, _ = e.svc.CreateTransaction(ctx, domain.Transaction{Date: day(2026, 11, 3), Type: domain.Expense, CategoryID: &e.housing.ID, Amount: 1000, SplitRule: &domain.SplitRule{ID: e.half.ID}})
	changed := e.half
	changed.MyPercent = 60
	if _, err := e.svc.UpdateSplitRule(ctx, changed); !errors.Is(err, domain.ErrSplitRuleInUse) {
		t.Fatalf("update error = %v, want ErrSplitRuleInUse", err)
	}
}

func TestRecurrences(t *testing.T) {
	e := newEnv(t)

	t.Run("create validates and checks the category kind", func(t *testing.T) {
		rec := domain.Recurrence{Day: 5, Description: "Salary", Type: domain.Income, CategoryID: e.housing.ID, EstimatedAmount: 100, Active: true}
		if _, err := e.svc.CreateRecurrence(ctx, rec); !errors.Is(err, domain.ErrCategoryKindMismatch) {
			t.Fatalf("error = %v, want ErrCategoryKindMismatch", err)
		}
		rec.CategoryID = e.salary.ID
		rec.Day = 40
		if _, err := e.svc.CreateRecurrence(ctx, rec); !errors.Is(err, domain.ErrInvalidDay) {
			t.Fatalf("error = %v, want ErrInvalidDay", err)
		}
	})

	t.Run("update and delete", func(t *testing.T) {
		created, err := e.svc.CreateRecurrence(ctx, domain.Recurrence{Day: 5, Description: "Salary", Type: domain.Income, CategoryID: e.salary.ID, EstimatedAmount: 100, Active: true})
		if err != nil || created.ID == 0 {
			t.Fatalf("create: %+v, %v", created, err)
		}
		created.EstimatedAmount = 200
		got, err := e.svc.UpdateRecurrence(ctx, created)
		if err != nil || got.EstimatedAmount != 200 {
			t.Fatalf("update: %+v, %v", got, err)
		}
		if err := e.svc.DeleteRecurrence(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := e.svc.UpdateRecurrence(ctx, created); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("update after delete error = %v, want ErrNotFound", err)
		}
	})
}

func TestGenerateRecurring(t *testing.T) {
	e := newEnv(t)
	november := domain.YearMonth{Year: 2026, Month: time.November}
	mk := func(desc string, d int, active bool) {
		t.Helper()
		_, err := e.svc.CreateRecurrence(ctx, domain.Recurrence{Day: d, Description: desc, Type: domain.Expense, CategoryID: e.housing.ID, EstimatedAmount: 1000, Active: active, SplitRule: &domain.SplitRule{ID: e.half.ID}})
		if err != nil {
			t.Fatal(err)
		}
	}
	mk("Electricity", 31, true)
	mk("Internet", 10, true)
	mk("Old gym", 15, false)

	first, err := e.svc.GenerateRecurring(ctx, november)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Created) != 2 || first.Skipped != 0 {
		t.Fatalf("first run created %d, skipped %d, want 2 and 0", len(first.Created), first.Skipped)
	}

	listed, _ := e.svc.ListTransactions(ctx, november)
	if len(listed) != 2 || !listed[1].Date.Equal(day(2026, 11, 30)) || listed[0].Confirmed {
		t.Fatalf("listed = %+v, want 2 unconfirmed, the 31st clamped to 30", listed)
	}
	if listed[0].SplitRule == nil || listed[0].SplitRule.MyPercent != 50 {
		t.Errorf("generated transaction lost its split rule: %+v", listed[0].SplitRule)
	}

	t.Run("second run only skips", func(t *testing.T) {
		again, err := e.svc.GenerateRecurring(ctx, november)
		if err != nil || len(again.Created) != 0 || again.Skipped != 2 {
			t.Fatalf("again = %+v, error = %v, want 0 created and 2 skipped", again, err)
		}
	})

	t.Run("moving a generated transaction to another month does not regenerate it", func(t *testing.T) {
		moved := listed[0]
		moved.Date = day(2026, 12, 2)
		if _, err := e.svc.UpdateTransaction(ctx, moved); err != nil {
			t.Fatal(err)
		}
		again, _ := e.svc.GenerateRecurring(ctx, november)
		if len(again.Created) != 0 {
			t.Fatalf("regenerated %d transactions, want 0", len(again.Created))
		}
	})
}

func TestReports(t *testing.T) {
	e := newEnv(t)
	archivedUnused, _ := e.svc.CreateCategory(ctx, domain.Category{Name: "Old", Kind: domain.Expense, Archived: true})
	archivedUsed, _ := e.svc.CreateCategory(ctx, domain.Category{Name: "Gym", Kind: domain.Expense})
	for _, tx := range []domain.Transaction{
		{Date: day(2026, 1, 5), Type: domain.Expense, CategoryID: &e.housing.ID, Amount: 20000, SplitRule: &domain.SplitRule{ID: e.half.ID}, Confirmed: true},
		{Date: day(2026, 1, 6), Type: domain.Expense, CategoryID: &archivedUsed.ID, Amount: 3000},
		{Date: day(2026, 1, 7), Type: domain.Settlement, Amount: 4000, Confirmed: true},
	} {
		if _, err := e.svc.CreateTransaction(ctx, tx); err != nil {
			t.Fatal(err)
		}
	}
	archivedUsed.Archived = true
	_, _ = e.svc.UpdateCategory(ctx, archivedUsed)

	t.Run("monthly", func(t *testing.T) {
		months, err := e.svc.MonthlyReport(ctx, 2026)
		if err != nil {
			t.Fatal(err)
		}
		jan := months[0]
		if jan.Planned.Gross.Expense != 23000 || jan.Planned.Mine.Expense != 13000 || jan.Realized.Gross.Expense != 20000 {
			t.Errorf("January = %+v", jan)
		}
		if jan.Planned.OwedToDate != 6000 { // 10000 shared - 4000 settled
			t.Errorf("OwedToDate = %d, want 6000", jan.Planned.OwedToDate)
		}
	})

	t.Run("categories hide archived ones without spending", func(t *testing.T) {
		rows, err := e.svc.CategoryReport(ctx, 2026, domain.Gross, domain.AllTransactions)
		if err != nil {
			t.Fatal(err)
		}
		names := map[string]domain.Money{}
		for _, r := range rows {
			names[r.Category.Name] = r.Total
		}
		if _, ok := names[archivedUnused.Name]; ok {
			t.Error("archived category without spending should be hidden")
		}
		if names["Gym"] != 3000 || names["Housing"] != 20000 {
			t.Errorf("totals = %v", names)
		}
		if _, ok := names["Salary"]; ok {
			t.Error("income category must not appear")
		}
	})
}

func TestUpdateSettings(t *testing.T) {
	e := newEnv(t)

	tests := []struct {
		name     string
		settings map[string]string
		wantErr  error
	}{
		{"valid", map[string]string{"partner_name": "Ana", "currency": "USD", "locale": "en"}, nil},
		{"lowercase currency", map[string]string{"currency": "usd"}, domain.ErrInvalidSetting},
		{"unsupported locale", map[string]string{"locale": "fr"}, domain.ErrInvalidSetting},
		{"unknown key", map[string]string{"theme": "dark"}, domain.ErrInvalidSetting},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := e.svc.UpdateSettings(ctx, tt.settings); !errors.Is(err, tt.wantErr) {
				t.Fatalf("error = %v, want %v", err, tt.wantErr)
			}
		})
	}

	t.Run("an invalid value writes nothing", func(t *testing.T) {
		before, _ := e.svc.Settings(ctx)
		err := e.svc.UpdateSettings(ctx, map[string]string{"partner_name": "Bia", "currency": "nope"})
		after, _ := e.svc.Settings(ctx)
		if err == nil || after["partner_name"] != before["partner_name"] {
			t.Fatalf("error = %v, partner_name %q -> %q, want rejected and unchanged", err, before["partner_name"], after["partner_name"])
		}
	})
}
