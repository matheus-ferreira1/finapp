package domain_test

import (
	"errors"
	"testing"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func TestCategoryValidate(t *testing.T) {
	tests := []struct {
		name    string
		c       domain.Category
		wantErr error
	}{
		{"income", domain.Category{Name: "Salary", Kind: domain.Income}, nil},
		{"expense", domain.Category{Name: "Food", Kind: domain.Expense}, nil},
		{"blank name", domain.Category{Name: " ", Kind: domain.Expense}, domain.ErrNameRequired},
		{"settlement is not a category kind", domain.Category{Name: "x", Kind: domain.Settlement}, domain.ErrInvalidType},
		{"unknown kind", domain.Category{Name: "x", Kind: "other"}, domain.ErrInvalidType},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.c.Validate(); !errors.Is(err, tt.wantErr) {
				t.Fatalf("Validate() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestErrValidation(t *testing.T) {
	for _, err := range []error{
		domain.ErrInvalidAmount, domain.ErrCategoryRequired, domain.ErrInvalidDay,
		domain.ErrInvalidYearMonth, domain.ErrCategoryKindMismatch, domain.ErrUnknownReference,
	} {
		if !errors.Is(err, domain.ErrValidation) {
			t.Errorf("%v should be a validation error", err)
		}
	}
	for _, err := range []error{domain.ErrNotFound, domain.ErrDuplicate, domain.ErrSplitRuleInUse} {
		if errors.Is(err, domain.ErrValidation) {
			t.Errorf("%v should not be a validation error", err)
		}
	}
}
