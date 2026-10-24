// Package app holds the use cases: they validate input against the domain rules,
// check references between entities and coordinate persistence.
package app

import (
	"context"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

// Store is the persistence the use cases need. It is implemented by storage/sqlite.
type Store interface {
	CreateCategory(ctx context.Context, c *domain.Category) error
	UpdateCategory(ctx context.Context, c domain.Category) error
	ListCategories(ctx context.Context, includeArchived bool) ([]domain.Category, error)

	CreateSplitRule(ctx context.Context, r *domain.SplitRule) error
	UpdateSplitRule(ctx context.Context, r domain.SplitRule) error
	ListSplitRules(ctx context.Context, includeArchived bool) ([]domain.SplitRule, error)

	CreateTransaction(ctx context.Context, tx *domain.Transaction) error
	UpdateTransaction(ctx context.Context, tx domain.Transaction) error
	DeleteTransaction(ctx context.Context, id int64) error
	GetTransaction(ctx context.Context, id int64) (domain.Transaction, error)
	ListTransactions(ctx context.Context) ([]domain.Transaction, error)
	ListTransactionsByMonth(ctx context.Context, ym domain.YearMonth) ([]domain.Transaction, error)
	ListGeneratedFor(ctx context.Context, ym domain.YearMonth) ([]domain.Transaction, error)

	CreateRecurrence(ctx context.Context, r *domain.Recurrence) error
	UpdateRecurrence(ctx context.Context, r domain.Recurrence) error
	DeleteRecurrence(ctx context.Context, id int64) error
	ListRecurrences(ctx context.Context) ([]domain.Recurrence, error)

	Settings(ctx context.Context) (map[string]string, error)
	SetSetting(ctx context.Context, key, value string) error
}

type Service struct {
	store Store
}

func New(store Store) *Service { return &Service{store: store} }

// resolveSplitRule replaces a rule given only by id with the stored one.
func (s *Service) resolveSplitRule(ctx context.Context, rule *domain.SplitRule) (*domain.SplitRule, error) {
	if rule == nil {
		return nil, nil
	}
	rules, err := s.store.ListSplitRules(ctx, true)
	if err != nil {
		return nil, err
	}
	for _, r := range rules {
		if r.ID == rule.ID {
			return &r, nil
		}
	}
	return nil, domain.ErrUnknownReference
}

// checkCategory makes sure the category exists and has the kind of the given type.
func (s *Service) checkCategory(ctx context.Context, id int64, typ domain.TransactionType) error {
	categories, err := s.store.ListCategories(ctx, true)
	if err != nil {
		return err
	}
	for _, c := range categories {
		if c.ID == id {
			if c.Kind != typ {
				return domain.ErrCategoryKindMismatch
			}
			return nil
		}
	}
	return domain.ErrUnknownReference
}
