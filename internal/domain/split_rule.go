package domain

import "strings"

// SplitRule describes how a shared expense is divided, e.g. "30/70" has MyPercent 30.
type SplitRule struct {
	ID        int64
	Name      string
	MyPercent int
}

func (r SplitRule) Validate() error {
	if strings.TrimSpace(r.Name) == "" {
		return ErrNameRequired
	}
	if r.MyPercent < 0 || r.MyPercent > 100 {
		return ErrInvalidSplitPercent
	}
	return nil
}
