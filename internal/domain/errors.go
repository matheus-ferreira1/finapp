package domain

import "errors"

// ErrValidation matches (errors.Is) every error caused by invalid input, so
// callers can tell a bad request from an internal failure.
var ErrValidation = errors.New("validation failed")

type validationError string

func (e validationError) Error() string { return string(e) }

func (validationError) Is(target error) bool { return target == ErrValidation }

var (
	ErrInvalidType          = validationError("invalid transaction type")
	ErrInvalidAmount        = validationError("amount must be greater than zero")
	ErrMissingDate          = validationError("date is required")
	ErrCategoryRequired     = validationError("category is required for income and expense")
	ErrCategoryNotAllowed   = validationError("settlement cannot have a category")
	ErrSplitNotAllowed      = validationError("split rule is only allowed on expenses")
	ErrInvalidSplitPercent  = validationError("split percent must be between 0 and 100")
	ErrInvalidInstallment   = validationError("installment must be a number between 1 and the total")
	ErrNameRequired         = validationError("name is required")
	ErrDescriptionRequired  = validationError("description is required")
	ErrInvalidDay           = validationError("day must be between 1 and 31")
	ErrInvalidYearMonth     = validationError("month must be in the YYYY-MM format")
	ErrCategoryKindMismatch = validationError("category kind does not match the transaction type")
	ErrKindImmutable        = validationError("category kind cannot be changed")
	ErrUnknownReference     = validationError("unknown category or split rule")
	ErrInvalidSetting       = validationError("invalid setting")
)

var (
	ErrNotFound       = errors.New("not found")
	ErrDuplicate      = errors.New("already exists")
	ErrSplitRuleInUse = errors.New("split rule is in use, archive it and create a new one instead of changing its percent")
)
