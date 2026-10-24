package app

import (
	"context"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (s *Service) ListTransactions(ctx context.Context, month domain.YearMonth) ([]domain.Transaction, error) {
	return s.store.ListTransactionsByMonth(ctx, month)
}

func (s *Service) CreateTransaction(ctx context.Context, tx domain.Transaction) (domain.Transaction, error) {
	tx, err := s.prepareTransaction(ctx, tx)
	if err != nil {
		return tx, err
	}
	if err := s.store.CreateTransaction(ctx, &tx); err != nil {
		return tx, err
	}
	return s.store.GetTransaction(ctx, tx.ID)
}

func (s *Service) UpdateTransaction(ctx context.Context, tx domain.Transaction) (domain.Transaction, error) {
	tx, err := s.prepareTransaction(ctx, tx)
	if err != nil {
		return tx, err
	}
	if err := s.store.UpdateTransaction(ctx, tx); err != nil {
		return tx, err
	}
	return s.store.GetTransaction(ctx, tx.ID)
}

func (s *Service) DeleteTransaction(ctx context.Context, id int64) error {
	return s.store.DeleteTransaction(ctx, id)
}

func (s *Service) prepareTransaction(ctx context.Context, tx domain.Transaction) (domain.Transaction, error) {
	rule, err := s.resolveSplitRule(ctx, tx.SplitRule)
	if err != nil {
		return tx, err
	}
	tx.SplitRule = rule

	if err := tx.Validate(); err != nil {
		return tx, err
	}
	if tx.CategoryID != nil {
		if err := s.checkCategory(ctx, *tx.CategoryID, tx.Type); err != nil {
			return tx, err
		}
	}
	return tx, nil
}
