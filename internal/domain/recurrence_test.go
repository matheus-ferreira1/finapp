package domain_test

import (
	"errors"
	"testing"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func TestParseYearMonth(t *testing.T) {
	tests := []struct {
		in      string
		want    domain.YearMonth
		wantErr bool
	}{
		{"2026-11", domain.YearMonth{Year: 2026, Month: time.November}, false},
		{"2026-01", domain.YearMonth{Year: 2026, Month: time.January}, false},
		{"2026-13", domain.YearMonth{}, true},
		{"2026-1", domain.YearMonth{}, true},
		{"11/2026", domain.YearMonth{}, true},
		{"", domain.YearMonth{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got, err := domain.ParseYearMonth(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("got %+v, want %+v", got, tt.want)
			}
			if err == nil && got.String() != tt.in {
				t.Errorf("String() = %q, want round trip %q", got.String(), tt.in)
			}
		})
	}
}

func validRecurrence(mod func(*domain.Recurrence)) domain.Recurrence {
	r := domain.Recurrence{
		ID:              1,
		Day:             5,
		Description:     "Salary",
		Type:            domain.Income,
		CategoryID:      10,
		EstimatedAmount: 500000,
		Active:          true,
	}
	mod(&r)
	return r
}

func TestRecurrenceValidate(t *testing.T) {
	tests := []struct {
		name    string
		r       domain.Recurrence
		wantErr error
	}{
		{"valid income", validRecurrence(func(*domain.Recurrence) {}), nil},
		{"valid shared expense", validRecurrence(func(r *domain.Recurrence) { r.Type, r.SplitRule = domain.Expense, rule(50) }), nil},
		{"day 31", validRecurrence(func(r *domain.Recurrence) { r.Day = 31 }), nil},
		{"day zero", validRecurrence(func(r *domain.Recurrence) { r.Day = 0 }), domain.ErrInvalidDay},
		{"day 32", validRecurrence(func(r *domain.Recurrence) { r.Day = 32 }), domain.ErrInvalidDay},
		{"blank description", validRecurrence(func(r *domain.Recurrence) { r.Description = " " }), domain.ErrDescriptionRequired},
		{"settlement not allowed", validRecurrence(func(r *domain.Recurrence) { r.Type = domain.Settlement }), domain.ErrInvalidType},
		{"zero amount", validRecurrence(func(r *domain.Recurrence) { r.EstimatedAmount = 0 }), domain.ErrInvalidAmount},
		{"missing category", validRecurrence(func(r *domain.Recurrence) { r.CategoryID = 0 }), domain.ErrCategoryRequired},
		{"split on income", validRecurrence(func(r *domain.Recurrence) { r.SplitRule = rule(50) }), domain.ErrSplitNotAllowed},
		{"invalid split percent", validRecurrence(func(r *domain.Recurrence) { r.Type, r.SplitRule = domain.Expense, rule(150) }), domain.ErrInvalidSplitPercent},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.r.Validate(); !errors.Is(err, tt.wantErr) {
				t.Fatalf("Validate() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestGenerateRecurring(t *testing.T) {
	salary := validRecurrence(func(r *domain.Recurrence) {})
	power := validRecurrence(func(r *domain.Recurrence) {
		r.ID, r.Day, r.Description = 2, 31, "Electricity"
		r.Type, r.CategoryID, r.EstimatedAmount, r.SplitRule = domain.Expense, 20, 18000, rule(50)
	})
	cancelled := validRecurrence(func(r *domain.Recurrence) { r.ID, r.Active = 3, false })

	generatedFor := func(id int64, ym domain.YearMonth) domain.Transaction {
		return domain.Transaction{Recurrence: &domain.RecurrenceRef{ID: id, Month: ym}}
	}
	november := domain.YearMonth{Year: 2026, Month: time.November}

	t.Run("creates unconfirmed transactions from active recurrences", func(t *testing.T) {
		created, skipped := domain.GenerateRecurring([]domain.Recurrence{salary, power, cancelled}, nil, november)

		if len(created) != 2 || skipped != 0 {
			t.Fatalf("created = %d, skipped = %d, want 2 and 0", len(created), skipped)
		}

		got := created[1]
		if !got.Date.Equal(on(2026, time.November, 30)) {
			t.Errorf("date = %v, want 30 Nov (day 31 clamped)", got.Date)
		}
		if got.Description != "Electricity" || got.Type != domain.Expense || got.Amount != 18000 {
			t.Errorf("unexpected transaction %+v", got)
		}
		if got.CategoryID == nil || *got.CategoryID != 20 {
			t.Errorf("CategoryID = %v, want 20", got.CategoryID)
		}
		if got.SplitRule == nil || got.SplitRule.MyPercent != 50 {
			t.Errorf("SplitRule = %+v, want 50/50", got.SplitRule)
		}
		if got.Confirmed {
			t.Error("generated transactions must start unconfirmed")
		}
		if got.Recurrence == nil || got.Recurrence.ID != 2 || got.Recurrence.Month != november {
			t.Errorf("Recurrence = %+v, want link to recurrence 2 in 2026-11", got.Recurrence)
		}
		for _, tx := range created {
			if err := tx.Validate(); err != nil {
				t.Errorf("generated transaction %q is invalid: %v", tx.Description, err)
			}
		}
	})

	t.Run("is idempotent: skips what was already generated for the month", func(t *testing.T) {
		existing := []domain.Transaction{generatedFor(1, november)}

		created, skipped := domain.GenerateRecurring([]domain.Recurrence{salary, power}, existing, november)

		if len(created) != 1 || created[0].Description != "Electricity" || skipped != 1 {
			t.Fatalf("created = %+v, skipped = %d, want only Electricity and 1 skipped", created, skipped)
		}
	})

	t.Run("generation in another month does not count as generated", func(t *testing.T) {
		october := domain.YearMonth{Year: 2026, Month: time.October}
		existing := []domain.Transaction{generatedFor(1, october)}

		created, skipped := domain.GenerateRecurring([]domain.Recurrence{salary}, existing, november)

		if len(created) != 1 || skipped != 0 {
			t.Fatalf("created = %d, skipped = %d, want 1 and 0", len(created), skipped)
		}
	})

	t.Run("day clamping", func(t *testing.T) {
		tests := []struct {
			ym   domain.YearMonth
			day  int
			want time.Time
		}{
			{domain.YearMonth{Year: 2026, Month: time.February}, 31, on(2026, time.February, 28)},
			{domain.YearMonth{Year: 2028, Month: time.February}, 30, on(2028, time.February, 29)}, // leap year
			{domain.YearMonth{Year: 2026, Month: time.April}, 31, on(2026, time.April, 30)},
			{domain.YearMonth{Year: 2026, Month: time.January}, 31, on(2026, time.January, 31)},
			{domain.YearMonth{Year: 2026, Month: time.March}, 1, on(2026, time.March, 1)},
		}
		for _, tt := range tests {
			r := validRecurrence(func(r *domain.Recurrence) { r.Day = tt.day })
			created, _ := domain.GenerateRecurring([]domain.Recurrence{r}, nil, tt.ym)
			if len(created) != 1 || !created[0].Date.Equal(tt.want) {
				t.Errorf("%s day %d: got %v, want %v", tt.ym, tt.day, created, tt.want)
			}
		}
	})
}
