package domain_test

import (
	"errors"
	"testing"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func ptr[T any](v T) *T { return &v }

func rule(percent int) *domain.SplitRule {
	return &domain.SplitRule{Name: "rule", MyPercent: percent}
}

func TestTransactionAmounts(t *testing.T) {
	tests := []struct {
		name       string
		tx         domain.Transaction
		wantMy     domain.Money
		wantShared domain.Money
	}{
		{"income is all mine", domain.Transaction{Type: domain.Income, Amount: 500000}, 500000, 0},
		{"expense without rule is all mine", domain.Transaction{Type: domain.Expense, Amount: 12345}, 12345, 0},
		{"expense 50/50", domain.Transaction{Type: domain.Expense, Amount: 10000, SplitRule: rule(50)}, 5000, 5000},
		{"expense 30/70", domain.Transaction{Type: domain.Expense, Amount: 10000, SplitRule: rule(30)}, 3000, 7000},
		{"odd cent rounds my part half up and shared takes the rest", domain.Transaction{Type: domain.Expense, Amount: 10001, SplitRule: rule(50)}, 5001, 5000},
		{"rounding never loses a cent", domain.Transaction{Type: domain.Expense, Amount: 1, SplitRule: rule(33)}, 0, 1},
		{"100 percent mine", domain.Transaction{Type: domain.Expense, Amount: 999, SplitRule: rule(100)}, 999, 0},
		{"0 percent mine", domain.Transaction{Type: domain.Expense, Amount: 999, SplitRule: rule(0)}, 0, 999},
		{"settlement is neither mine nor shared", domain.Transaction{Type: domain.Settlement, Amount: 7000}, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.tx.My(); got != tt.wantMy {
				t.Errorf("My() = %d, want %d", got, tt.wantMy)
			}
			if got := tt.tx.Shared(); got != tt.wantShared {
				t.Errorf("Shared() = %d, want %d", got, tt.wantShared)
			}
			if tt.tx.Type == domain.Expense && tt.tx.My()+tt.tx.Shared() != tt.tx.Amount {
				t.Errorf("My()+Shared() = %d, want amount %d", tt.tx.My()+tt.tx.Shared(), tt.tx.Amount)
			}
		})
	}
}

func TestTransactionValidate(t *testing.T) {
	valid := func(mod func(*domain.Transaction)) domain.Transaction {
		tx := domain.Transaction{
			Date:        time.Date(2026, 10, 24, 0, 0, 0, 0, time.UTC),
			Description: "Electricity",
			Type:        domain.Expense,
			CategoryID:  ptr(int64(1)),
			Amount:      15000,
		}
		mod(&tx)
		return tx
	}

	tests := []struct {
		name    string
		tx      domain.Transaction
		wantErr error
	}{
		{"valid expense", valid(func(*domain.Transaction) {}), nil},
		{"valid shared expense", valid(func(tx *domain.Transaction) { tx.SplitRule = rule(50) }), nil},
		{"valid installment", valid(func(tx *domain.Transaction) { tx.InstallmentNumber, tx.InstallmentTotal = ptr(2), ptr(12) }), nil},
		{"valid settlement", valid(func(tx *domain.Transaction) { tx.Type, tx.CategoryID = domain.Settlement, nil }), nil},
		{"unknown type", valid(func(tx *domain.Transaction) { tx.Type = "gift" }), domain.ErrInvalidType},
		{"zero amount", valid(func(tx *domain.Transaction) { tx.Amount = 0 }), domain.ErrInvalidAmount},
		{"negative amount", valid(func(tx *domain.Transaction) { tx.Amount = -1 }), domain.ErrInvalidAmount},
		{"missing date", valid(func(tx *domain.Transaction) { tx.Date = time.Time{} }), domain.ErrMissingDate},
		{"expense without category", valid(func(tx *domain.Transaction) { tx.CategoryID = nil }), domain.ErrCategoryRequired},
		{"income without category", valid(func(tx *domain.Transaction) { tx.Type, tx.CategoryID = domain.Income, nil }), domain.ErrCategoryRequired},
		{"settlement with category", valid(func(tx *domain.Transaction) { tx.Type = domain.Settlement }), domain.ErrCategoryNotAllowed},
		{"split rule on income", valid(func(tx *domain.Transaction) { tx.Type, tx.SplitRule = domain.Income, rule(50) }), domain.ErrSplitNotAllowed},
		{"split rule on settlement", valid(func(tx *domain.Transaction) {
			tx.Type, tx.CategoryID, tx.SplitRule = domain.Settlement, nil, rule(50)
		}), domain.ErrSplitNotAllowed},
		{"invalid split percent", valid(func(tx *domain.Transaction) { tx.SplitRule = rule(101) }), domain.ErrInvalidSplitPercent},
		{"installment number without total", valid(func(tx *domain.Transaction) { tx.InstallmentNumber = ptr(2) }), domain.ErrInvalidInstallment},
		{"installment number above total", valid(func(tx *domain.Transaction) { tx.InstallmentNumber, tx.InstallmentTotal = ptr(13), ptr(12) }), domain.ErrInvalidInstallment},
		{"installment number zero", valid(func(tx *domain.Transaction) { tx.InstallmentNumber, tx.InstallmentTotal = ptr(0), ptr(12) }), domain.ErrInvalidInstallment},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.tx.Validate()
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Validate() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestSplitRuleValidate(t *testing.T) {
	tests := []struct {
		name    string
		rule    domain.SplitRule
		wantErr error
	}{
		{"50/50", domain.SplitRule{Name: "50/50", MyPercent: 50}, nil},
		{"bounds 0", domain.SplitRule{Name: "all theirs", MyPercent: 0}, nil},
		{"bounds 100", domain.SplitRule{Name: "all mine", MyPercent: 100}, nil},
		{"above 100", domain.SplitRule{Name: "x", MyPercent: 101}, domain.ErrInvalidSplitPercent},
		{"negative", domain.SplitRule{Name: "x", MyPercent: -1}, domain.ErrInvalidSplitPercent},
		{"blank name", domain.SplitRule{Name: "  ", MyPercent: 50}, domain.ErrNameRequired},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.rule.Validate(); !errors.Is(err, tt.wantErr) {
				t.Fatalf("Validate() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
