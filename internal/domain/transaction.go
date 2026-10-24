package domain

import "time"

// TransactionType defines the direction of a transaction. Amounts are always positive.
type TransactionType string

const (
	Income     TransactionType = "income"
	Expense    TransactionType = "expense"
	Settlement TransactionType = "settlement" // money received from the partner for shared expenses
)

type Transaction struct {
	ID                int64
	Date              time.Time
	Description       string
	Type              TransactionType
	CategoryID        *int64
	Amount            Money
	SplitRule         *SplitRule
	InstallmentNumber *int
	InstallmentTotal  *int
	Confirmed         bool
}

// My is the part of the transaction that is really mine.
func (t Transaction) My() Money {
	switch t.Type {
	case Settlement:
		return 0
	case Expense:
		if t.SplitRule != nil {
			// Half-up rounding; Shared takes the remainder so no cent is lost.
			return (t.Amount*Money(t.SplitRule.MyPercent) + 50) / 100
		}
	}
	return t.Amount
}

// Shared is the part of an expense the partner owes me.
func (t Transaction) Shared() Money {
	if t.Type != Expense {
		return 0
	}
	return t.Amount - t.My()
}

func (t Transaction) Validate() error {
	switch t.Type {
	case Income, Expense, Settlement:
	default:
		return ErrInvalidType
	}
	if t.Amount <= 0 {
		return ErrInvalidAmount
	}
	if t.Date.IsZero() {
		return ErrMissingDate
	}
	if t.Type == Settlement && t.CategoryID != nil {
		return ErrCategoryNotAllowed
	}
	if t.Type != Settlement && t.CategoryID == nil {
		return ErrCategoryRequired
	}
	if t.SplitRule != nil {
		if t.Type != Expense {
			return ErrSplitNotAllowed
		}
		if err := t.SplitRule.Validate(); err != nil {
			return err
		}
	}
	return t.validateInstallment()
}

func (t Transaction) validateInstallment() error {
	if t.InstallmentNumber == nil && t.InstallmentTotal == nil {
		return nil
	}
	if t.InstallmentNumber == nil || t.InstallmentTotal == nil ||
		*t.InstallmentNumber < 1 || *t.InstallmentNumber > *t.InstallmentTotal {
		return ErrInvalidInstallment
	}
	return nil
}
