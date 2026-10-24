package domain

import (
	"fmt"
	"time"
)

// YearMonth identifies a calendar month.
type YearMonth struct {
	Year  int
	Month time.Month
}

// ParseYearMonth parses the YYYY-MM format.
func ParseYearMonth(s string) (YearMonth, error) {
	t, err := time.Parse("2006-01", s)
	if err != nil {
		return YearMonth{}, ErrInvalidYearMonth
	}
	return YearMonth{Year: t.Year(), Month: t.Month()}, nil
}

func (ym YearMonth) String() string {
	return fmt.Sprintf("%04d-%02d", ym.Year, int(ym.Month))
}

// date returns the given day of the month, clamped to its last day.
func (ym YearMonth) date(day int) time.Time {
	lastDay := time.Date(ym.Year, ym.Month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	return time.Date(ym.Year, ym.Month, min(day, lastDay), 0, 0, 0, 0, time.UTC)
}
