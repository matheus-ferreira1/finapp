package app

import (
	"context"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (s *Service) ListCategories(ctx context.Context, includeArchived bool) ([]domain.Category, error) {
	return s.store.ListCategories(ctx, includeArchived)
}

func (s *Service) CreateCategory(ctx context.Context, c domain.Category) (domain.Category, error) {
	if err := c.Validate(); err != nil {
		return c, err
	}
	err := s.store.CreateCategory(ctx, &c)
	return c, err
}

// UpdateCategory renames or archives a category. Its kind cannot change, because
// transactions already match it.
func (s *Service) UpdateCategory(ctx context.Context, c domain.Category) (domain.Category, error) {
	if err := c.Validate(); err != nil {
		return c, err
	}
	existing, err := s.store.ListCategories(ctx, true)
	if err != nil {
		return c, err
	}
	for _, e := range existing {
		if e.ID == c.ID {
			if e.Kind != c.Kind {
				return c, domain.ErrKindImmutable
			}
			return c, s.store.UpdateCategory(ctx, c)
		}
	}
	return c, domain.ErrNotFound
}

func (s *Service) ListSplitRules(ctx context.Context, includeArchived bool) ([]domain.SplitRule, error) {
	return s.store.ListSplitRules(ctx, includeArchived)
}

func (s *Service) CreateSplitRule(ctx context.Context, r domain.SplitRule) (domain.SplitRule, error) {
	if err := r.Validate(); err != nil {
		return r, err
	}
	err := s.store.CreateSplitRule(ctx, &r)
	return r, err
}

func (s *Service) UpdateSplitRule(ctx context.Context, r domain.SplitRule) (domain.SplitRule, error) {
	if err := r.Validate(); err != nil {
		return r, err
	}
	return r, s.store.UpdateSplitRule(ctx, r)
}
