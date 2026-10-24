package domain

import "errors"

var (
	ErrInvalidType         = errors.New("invalid transaction type")
	ErrInvalidAmount       = errors.New("amount must be greater than zero")
	ErrMissingDate         = errors.New("date is required")
	ErrCategoryRequired    = errors.New("category is required for income and expense")
	ErrCategoryNotAllowed  = errors.New("settlement cannot have a category")
	ErrSplitNotAllowed     = errors.New("split rule is only allowed on expenses")
	ErrInvalidSplitPercent = errors.New("split percent must be between 0 and 100")
	ErrInvalidInstallment  = errors.New("installment must be a number between 1 and the total")
	ErrNameRequired        = errors.New("name is required")
	ErrDescriptionRequired = errors.New("description is required")
	ErrInvalidDay          = errors.New("day must be between 1 and 31")
	ErrInvalidYearMonth    = errors.New("month must be in the YYYY-MM format")
)
