package domain

import "strings"

// Category groups income or expense transactions. Settlements have no category.
type Category struct {
	ID       int64
	Name     string
	Kind     TransactionType // Income or Expense
	Archived bool
}

func (c Category) Validate() error {
	if strings.TrimSpace(c.Name) == "" {
		return ErrNameRequired
	}
	if c.Kind != Income && c.Kind != Expense {
		return ErrInvalidType
	}
	return nil
}
