package httpapi

import (
	"net/http"
	"strconv"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (a *api) listCategories(r *http.Request) (int, any, error) {
	categories, err := a.svc.ListCategories(r.Context(), r.URL.Query().Get("archived") == "true")
	if err != nil {
		return 0, nil, err
	}
	out := make([]categoryDTO, len(categories))
	for i, c := range categories {
		out[i] = categoryResponse(c)
	}
	return http.StatusOK, out, nil
}

func (a *api) createCategory(r *http.Request) (int, any, error) {
	var in categoryDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	c, err := a.svc.CreateCategory(r.Context(), in.toDomain(0))
	if err != nil {
		return 0, nil, err
	}
	return http.StatusCreated, categoryResponse(c), nil
}

func (a *api) updateCategory(r *http.Request) (int, any, error) {
	id, err := pathID(r)
	if err != nil {
		return 0, nil, err
	}
	var in categoryDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	c, err := a.svc.UpdateCategory(r.Context(), in.toDomain(id))
	if err != nil {
		return 0, nil, err
	}
	return http.StatusOK, categoryResponse(c), nil
}

func (a *api) listSplitRules(r *http.Request) (int, any, error) {
	rules, err := a.svc.ListSplitRules(r.Context(), r.URL.Query().Get("archived") == "true")
	if err != nil {
		return 0, nil, err
	}
	out := make([]splitRuleDTO, len(rules))
	for i, rule := range rules {
		out[i] = splitRuleResponse(rule)
	}
	return http.StatusOK, out, nil
}

func (a *api) createSplitRule(r *http.Request) (int, any, error) {
	var in splitRuleDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	rule, err := a.svc.CreateSplitRule(r.Context(), in.toDomain(0))
	if err != nil {
		return 0, nil, err
	}
	return http.StatusCreated, splitRuleResponse(rule), nil
}

func (a *api) updateSplitRule(r *http.Request) (int, any, error) {
	id, err := pathID(r)
	if err != nil {
		return 0, nil, err
	}
	var in splitRuleDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	rule, err := a.svc.UpdateSplitRule(r.Context(), in.toDomain(id))
	if err != nil {
		return 0, nil, err
	}
	return http.StatusOK, splitRuleResponse(rule), nil
}

func (a *api) listTransactions(r *http.Request) (int, any, error) {
	raw := r.URL.Query().Get("month")
	if raw == "" {
		return 0, nil, badRequest("month is required (YYYY-MM)")
	}
	month, err := domain.ParseYearMonth(raw)
	if err != nil {
		return 0, nil, err
	}
	txs, err := a.svc.ListTransactions(r.Context(), month)
	if err != nil {
		return 0, nil, err
	}
	return http.StatusOK, transactionsResponse(txs), nil
}

func (a *api) createTransaction(r *http.Request) (int, any, error) {
	var in transactionDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	tx, err := in.toDomain(0)
	if err != nil {
		return 0, nil, err
	}
	saved, err := a.svc.CreateTransaction(r.Context(), tx)
	if err != nil {
		return 0, nil, err
	}
	return http.StatusCreated, transactionResponse(saved), nil
}

func (a *api) updateTransaction(r *http.Request) (int, any, error) {
	id, err := pathID(r)
	if err != nil {
		return 0, nil, err
	}
	var in transactionDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	tx, err := in.toDomain(id)
	if err != nil {
		return 0, nil, err
	}
	saved, err := a.svc.UpdateTransaction(r.Context(), tx)
	if err != nil {
		return 0, nil, err
	}
	return http.StatusOK, transactionResponse(saved), nil
}

func (a *api) deleteTransaction(r *http.Request) (int, any, error) {
	id, err := pathID(r)
	if err != nil {
		return 0, nil, err
	}
	return http.StatusNoContent, nil, a.svc.DeleteTransaction(r.Context(), id)
}

func (a *api) listRecurrences(r *http.Request) (int, any, error) {
	recurrences, err := a.svc.ListRecurrences(r.Context())
	if err != nil {
		return 0, nil, err
	}
	out := make([]recurrenceDTO, len(recurrences))
	for i, rec := range recurrences {
		out[i] = recurrenceResponse(rec)
	}
	return http.StatusOK, out, nil
}

func (a *api) createRecurrence(r *http.Request) (int, any, error) {
	var in recurrenceDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	rec, err := a.svc.CreateRecurrence(r.Context(), in.toDomain(0))
	if err != nil {
		return 0, nil, err
	}
	return http.StatusCreated, recurrenceResponse(rec), nil
}

func (a *api) updateRecurrence(r *http.Request) (int, any, error) {
	id, err := pathID(r)
	if err != nil {
		return 0, nil, err
	}
	var in recurrenceDTO
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	rec, err := a.svc.UpdateRecurrence(r.Context(), in.toDomain(id))
	if err != nil {
		return 0, nil, err
	}
	return http.StatusOK, recurrenceResponse(rec), nil
}

func (a *api) deleteRecurrence(r *http.Request) (int, any, error) {
	id, err := pathID(r)
	if err != nil {
		return 0, nil, err
	}
	return http.StatusNoContent, nil, a.svc.DeleteRecurrence(r.Context(), id)
}

func (a *api) generateRecurrences(r *http.Request) (int, any, error) {
	var in struct {
		Month string `json:"month"`
	}
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	month, err := domain.ParseYearMonth(in.Month)
	if err != nil {
		return 0, nil, err
	}
	result, err := a.svc.GenerateRecurring(r.Context(), month)
	if err != nil {
		return 0, nil, err
	}
	return http.StatusOK, map[string]any{
		"created": transactionsResponse(result.Created),
		"skipped": result.Skipped,
	}, nil
}

func parseYear(r *http.Request) (int, error) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year < 1 || year > 9999 {
		return 0, badRequest("year is required and must be between 1 and 9999")
	}
	return year, nil
}

func (a *api) monthlyReport(r *http.Request) (int, any, error) {
	year, err := parseYear(r)
	if err != nil {
		return 0, nil, err
	}
	months, err := a.svc.MonthlyReport(r.Context(), year)
	if err != nil {
		return 0, nil, err
	}

	out := monthlyReportDTO{Year: year, Months: make([]monthSummaryDTO, len(months))}
	for i, m := range months {
		out.Months[i] = monthSummaryDTO{
			Month:    int(m.Month),
			Planned:  figuresResponse(m.Planned),
			Realized: figuresResponse(m.Realized),
		}
	}
	return http.StatusOK, out, nil
}

func (a *api) categoryReport(r *http.Request) (int, any, error) {
	year, err := parseYear(r)
	if err != nil {
		return 0, nil, err
	}

	view, scope := domain.Gross, domain.AllTransactions
	viewName, scopeName := "gross", "all"
	switch q := r.URL.Query().Get("view"); q {
	case "", "gross":
	case "mine":
		view, viewName = domain.Mine, "mine"
	default:
		return 0, nil, badRequest("view must be gross or mine")
	}
	switch q := r.URL.Query().Get("scope"); q {
	case "", "all":
	case "confirmed":
		scope, scopeName = domain.ConfirmedOnly, "confirmed"
	default:
		return 0, nil, badRequest("scope must be all or confirmed")
	}

	rows, err := a.svc.CategoryReport(r.Context(), year, view, scope)
	if err != nil {
		return 0, nil, err
	}

	out := categoryReportDTO{Year: year, View: viewName, Scope: scopeName, Rows: make([]categoryRowDTO, len(rows))}
	for i, row := range rows {
		months := make([]int64, len(row.Months))
		for j, m := range row.Months {
			months[j] = int64(m)
		}
		out.Rows[i] = categoryRowDTO{
			CategoryID: row.Category.ID,
			Name:       row.Category.Name,
			Archived:   row.Category.Archived,
			Months:     months,
			TotalCents: int64(row.Total),
		}
	}
	return http.StatusOK, out, nil
}

func (a *api) getSettings(r *http.Request) (int, any, error) {
	settings, err := a.svc.Settings(r.Context())
	if err != nil {
		return 0, nil, err
	}
	return http.StatusOK, settings, nil
}

func (a *api) updateSettings(r *http.Request) (int, any, error) {
	var in map[string]string
	if err := decode(r, &in); err != nil {
		return 0, nil, err
	}
	if err := a.svc.UpdateSettings(r.Context(), in); err != nil {
		return 0, nil, err
	}
	return a.getSettings(r)
}
