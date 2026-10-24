package domain

// Category groups income or expense transactions. Settlements have no category.
type Category struct {
	ID       int64
	Name     string
	Kind     TransactionType // Income or Expense
	Archived bool
}
