package domain

import "strings"

// Recurrence is an income or expense that happens every month.
type Recurrence struct {
	ID              int64
	Day             int // day of the month, 1..31
	Description     string
	Type            TransactionType // Income or Expense
	CategoryID      int64
	EstimatedAmount Money
	SplitRule       *SplitRule
	Active          bool
}

// RecurrenceRef links a transaction to the recurrence and month it was generated for.
type RecurrenceRef struct {
	ID    int64
	Month YearMonth
}

func (r Recurrence) Validate() error {
	if r.Day < 1 || r.Day > 31 {
		return ErrInvalidDay
	}
	if strings.TrimSpace(r.Description) == "" {
		return ErrDescriptionRequired
	}
	if r.Type != Income && r.Type != Expense {
		return ErrInvalidType
	}
	if r.EstimatedAmount <= 0 {
		return ErrInvalidAmount
	}
	if r.CategoryID == 0 {
		return ErrCategoryRequired
	}
	if r.SplitRule != nil {
		if r.Type != Expense {
			return ErrSplitNotAllowed
		}
		return r.SplitRule.Validate()
	}
	return nil
}

// GenerateRecurring creates the transactions of the active recurrences for month.
// A recurrence that already has a transaction in existing for that month is
// skipped and counted, so generating the same month twice creates nothing new.
// Inactive recurrences are ignored. When the month is shorter than the
// recurrence day, the last day of the month is used.
func GenerateRecurring(recurrences []Recurrence, existing []Transaction, month YearMonth) (created []Transaction, skipped int) {
	generated := make(map[int64]bool)
	for _, tx := range existing {
		if tx.Recurrence != nil && tx.Recurrence.Month == month {
			generated[tx.Recurrence.ID] = true
		}
	}

	for _, r := range recurrences {
		if !r.Active {
			continue
		}
		if generated[r.ID] {
			skipped++
			continue
		}
		categoryID := r.CategoryID
		created = append(created, Transaction{
			Date:        month.date(r.Day),
			Description: r.Description,
			Type:        r.Type,
			CategoryID:  &categoryID,
			Amount:      r.EstimatedAmount,
			SplitRule:   r.SplitRule,
			Recurrence:  &RecurrenceRef{ID: r.ID, Month: month},
		})
	}
	return created, skipped
}
