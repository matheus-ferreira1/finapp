package httpapi

import (
	"time"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

const dateLayout = "2006-01-02"

type categoryDTO struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Archived bool   `json:"archived"`
}

func (d categoryDTO) toDomain(id int64) domain.Category {
	return domain.Category{ID: id, Name: d.Name, Kind: domain.TransactionType(d.Kind), Archived: d.Archived}
}

func categoryResponse(c domain.Category) categoryDTO {
	return categoryDTO{ID: c.ID, Name: c.Name, Kind: string(c.Kind), Archived: c.Archived}
}

type splitRuleDTO struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	MyPercent int    `json:"my_percent"`
	Archived  bool   `json:"archived"`
}

func (d splitRuleDTO) toDomain(id int64) domain.SplitRule {
	return domain.SplitRule{ID: id, Name: d.Name, MyPercent: d.MyPercent, Archived: d.Archived}
}

func splitRuleResponse(r domain.SplitRule) splitRuleDTO {
	return splitRuleDTO{ID: r.ID, Name: r.Name, MyPercent: r.MyPercent, Archived: r.Archived}
}

// transactionDTO is used for requests and responses. my_cents, shared_cents,
// recurrence_id and recurrence_month are computed by the server and ignored on input.
type transactionDTO struct {
	ID                int64   `json:"id"`
	Date              string  `json:"date"`
	Description       string  `json:"description"`
	Type              string  `json:"type"`
	CategoryID        *int64  `json:"category_id"`
	AmountCents       int64   `json:"amount_cents"`
	SplitRuleID       *int64  `json:"split_rule_id"`
	InstallmentNumber *int    `json:"installment_number"`
	InstallmentTotal  *int    `json:"installment_total"`
	Confirmed         bool    `json:"confirmed"`
	MyCents           int64   `json:"my_cents"`
	SharedCents       int64   `json:"shared_cents"`
	RecurrenceID      *int64  `json:"recurrence_id"`
	RecurrenceMonth   *string `json:"recurrence_month"`
}

func (d transactionDTO) toDomain(id int64) (domain.Transaction, error) {
	date, err := time.Parse(dateLayout, d.Date)
	if err != nil {
		return domain.Transaction{}, badRequest("date must be in the YYYY-MM-DD format")
	}
	tx := domain.Transaction{
		ID:                id,
		Date:              date,
		Description:       d.Description,
		Type:              domain.TransactionType(d.Type),
		CategoryID:        d.CategoryID,
		Amount:            domain.Money(d.AmountCents),
		InstallmentNumber: d.InstallmentNumber,
		InstallmentTotal:  d.InstallmentTotal,
		Confirmed:         d.Confirmed,
	}
	if d.SplitRuleID != nil {
		tx.SplitRule = &domain.SplitRule{ID: *d.SplitRuleID}
	}
	return tx, nil
}

func transactionResponse(tx domain.Transaction) transactionDTO {
	d := transactionDTO{
		ID:                tx.ID,
		Date:              tx.Date.Format(dateLayout),
		Description:       tx.Description,
		Type:              string(tx.Type),
		CategoryID:        tx.CategoryID,
		AmountCents:       int64(tx.Amount),
		InstallmentNumber: tx.InstallmentNumber,
		InstallmentTotal:  tx.InstallmentTotal,
		Confirmed:         tx.Confirmed,
		MyCents:           int64(tx.My()),
		SharedCents:       int64(tx.Shared()),
	}
	if tx.SplitRule != nil {
		d.SplitRuleID = &tx.SplitRule.ID
	}
	if tx.Recurrence != nil {
		month := tx.Recurrence.Month.String()
		d.RecurrenceID, d.RecurrenceMonth = &tx.Recurrence.ID, &month
	}
	return d
}

func transactionsResponse(txs []domain.Transaction) []transactionDTO {
	out := make([]transactionDTO, len(txs))
	for i, tx := range txs {
		out[i] = transactionResponse(tx)
	}
	return out
}

type recurrenceDTO struct {
	ID                   int64  `json:"id"`
	Day                  int    `json:"day"`
	Description          string `json:"description"`
	Type                 string `json:"type"`
	CategoryID           int64  `json:"category_id"`
	EstimatedAmountCents int64  `json:"estimated_amount_cents"`
	SplitRuleID          *int64 `json:"split_rule_id"`
	Active               bool   `json:"active"`
}

func (d recurrenceDTO) toDomain(id int64) domain.Recurrence {
	r := domain.Recurrence{
		ID:              id,
		Day:             d.Day,
		Description:     d.Description,
		Type:            domain.TransactionType(d.Type),
		CategoryID:      d.CategoryID,
		EstimatedAmount: domain.Money(d.EstimatedAmountCents),
		Active:          d.Active,
	}
	if d.SplitRuleID != nil {
		r.SplitRule = &domain.SplitRule{ID: *d.SplitRuleID}
	}
	return r
}

func recurrenceResponse(r domain.Recurrence) recurrenceDTO {
	d := recurrenceDTO{
		ID:                   r.ID,
		Day:                  r.Day,
		Description:          r.Description,
		Type:                 string(r.Type),
		CategoryID:           r.CategoryID,
		EstimatedAmountCents: int64(r.EstimatedAmount),
		Active:               r.Active,
	}
	if r.SplitRule != nil {
		d.SplitRuleID = &r.SplitRule.ID
	}
	return d
}

type totalsDTO struct {
	IncomeCents  int64 `json:"income_cents"`
	ExpenseCents int64 `json:"expense_cents"`
	BalanceCents int64 `json:"balance_cents"`
}

func totalsResponse(t domain.Totals) totalsDTO {
	return totalsDTO{IncomeCents: int64(t.Income), ExpenseCents: int64(t.Expense), BalanceCents: int64(t.Balance())}
}

type figuresDTO struct {
	Gross           totalsDTO `json:"gross"`
	Mine            totalsDTO `json:"mine"`
	SharedCents     int64     `json:"shared_cents"`
	SettledCents    int64     `json:"settled_cents"`
	OwedCents       int64     `json:"owed_cents"`
	OwedToDateCents int64     `json:"owed_to_date_cents"`
}

func figuresResponse(f domain.Figures) figuresDTO {
	return figuresDTO{
		Gross:           totalsResponse(f.Gross),
		Mine:            totalsResponse(f.Mine),
		SharedCents:     int64(f.Shared),
		SettledCents:    int64(f.Settled),
		OwedCents:       int64(f.Owed()),
		OwedToDateCents: int64(f.OwedToDate),
	}
}

type monthSummaryDTO struct {
	Month    int        `json:"month"`
	Planned  figuresDTO `json:"planned"`
	Realized figuresDTO `json:"realized"`
}

type monthlyReportDTO struct {
	Year   int               `json:"year"`
	Months []monthSummaryDTO `json:"months"`
}

type categoryRowDTO struct {
	CategoryID int64   `json:"category_id"`
	Name       string  `json:"name"`
	Archived   bool    `json:"archived"`
	Months     []int64 `json:"months"`
	TotalCents int64   `json:"total_cents"`
}

type categoryReportDTO struct {
	Year  int              `json:"year"`
	View  string           `json:"view"`
	Scope string           `json:"scope"`
	Rows  []categoryRowDTO `json:"rows"`
}
