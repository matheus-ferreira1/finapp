package app

import (
	"context"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (s *Service) MonthlyReport(ctx context.Context, year int) ([12]domain.MonthSummary, error) {
	txs, err := s.store.ListTransactions(ctx)
	if err != nil {
		return [12]domain.MonthSummary{}, err
	}
	return domain.MonthlySummaries(year, txs), nil
}

// CategoryReport lists the expense categories of the year. Archived categories
// only appear when they have spending, so old history stays visible.
func (s *Service) CategoryReport(ctx context.Context, year int, view domain.View, scope domain.Scope) ([]domain.CategoryRow, error) {
	categories, err := s.store.ListCategories(ctx, true)
	if err != nil {
		return nil, err
	}
	txs, err := s.store.ListTransactions(ctx)
	if err != nil {
		return nil, err
	}

	var rows []domain.CategoryRow
	for _, row := range domain.CategoryReport(year, categories, txs, view, scope) {
		if row.Category.Archived && row.Total == 0 {
			continue
		}
		rows = append(rows, row)
	}
	return rows, nil
}
