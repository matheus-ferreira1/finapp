package app

import (
	"context"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (s *Service) ListRecurrences(ctx context.Context) ([]domain.Recurrence, error) {
	return s.store.ListRecurrences(ctx)
}

func (s *Service) CreateRecurrence(ctx context.Context, r domain.Recurrence) (domain.Recurrence, error) {
	r, err := s.prepareRecurrence(ctx, r)
	if err != nil {
		return r, err
	}
	err = s.store.CreateRecurrence(ctx, &r)
	return r, err
}

func (s *Service) UpdateRecurrence(ctx context.Context, r domain.Recurrence) (domain.Recurrence, error) {
	r, err := s.prepareRecurrence(ctx, r)
	if err != nil {
		return r, err
	}
	return r, s.store.UpdateRecurrence(ctx, r)
}

func (s *Service) DeleteRecurrence(ctx context.Context, id int64) error {
	return s.store.DeleteRecurrence(ctx, id)
}

func (s *Service) prepareRecurrence(ctx context.Context, r domain.Recurrence) (domain.Recurrence, error) {
	rule, err := s.resolveSplitRule(ctx, r.SplitRule)
	if err != nil {
		return r, err
	}
	r.SplitRule = rule

	if err := r.Validate(); err != nil {
		return r, err
	}
	return r, s.checkCategory(ctx, r.CategoryID, r.Type)
}

// Generation is the outcome of generating a month: what was created and how
// many recurrences already had their transaction.
type Generation struct {
	Created []domain.Transaction
	Skipped int
}

// GenerateRecurring creates the transactions of the active recurrences for the
// month. It is safe to run again: recurrences already generated are skipped,
// even when their transaction was later moved to another date.
func (s *Service) GenerateRecurring(ctx context.Context, month domain.YearMonth) (Generation, error) {
	recurrences, err := s.store.ListRecurrences(ctx)
	if err != nil {
		return Generation{}, err
	}
	existing, err := s.store.ListGeneratedFor(ctx, month)
	if err != nil {
		return Generation{}, err
	}

	toCreate, skipped := domain.GenerateRecurring(recurrences, existing, month)
	result := Generation{Skipped: skipped}
	for _, tx := range toCreate {
		if err := s.store.CreateTransaction(ctx, &tx); err != nil {
			return result, err
		}
		result.Created = append(result.Created, tx)
	}
	return result, nil
}
