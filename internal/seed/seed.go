// Package seed fills an empty database with realistic sample data for local development.
package seed

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/domain"
)

// ErrNotEmpty is returned when the database already has data: seeding it would mix
// sample data with real data.
var ErrNotEmpty = errors.New("database is not empty")

const monthsToSeed = 6

// Run populates an empty database with sample data for the last six months ending at
// now's month. Past months are confirmed; in the current month only what is due by now
// is. The data is the same on every run, only the dates move with now.
func Run(ctx context.Context, svc *app.Service, now time.Time) error {
	if err := ensureEmpty(ctx, svc, now); err != nil {
		return err
	}
	s := &seeder{ctx: ctx, svc: svc, today: truncateDay(now)}
	return s.run()
}

type seeder struct {
	ctx   context.Context
	svc   *app.Service
	today time.Time

	categories map[string]int64
	rules      map[string]*domain.SplitRule
}

// ensureEmpty fails with ErrNotEmpty when the database holds anything of the user's:
// catalog entries, a partner name, or transactions in the months about to be seeded.
func ensureEmpty(ctx context.Context, svc *app.Service, now time.Time) error {
	categories, err := svc.ListCategories(ctx, true)
	if err != nil {
		return err
	}
	rules, err := svc.ListSplitRules(ctx, true)
	if err != nil {
		return err
	}
	recurrences, err := svc.ListRecurrences(ctx)
	if err != nil {
		return err
	}
	settings, err := svc.Settings(ctx)
	if err != nil {
		return err
	}
	if len(categories)+len(rules)+len(recurrences) > 0 || settings["partner_name"] != "" {
		return ErrNotEmpty
	}
	for i := 0; i < monthsToSeed; i++ {
		txs, err := svc.ListTransactions(ctx, monthAt(now, i))
		if err != nil {
			return err
		}
		if len(txs) > 0 {
			return ErrNotEmpty
		}
	}
	return nil
}

func (s *seeder) run() error {
	steps := []func() error{
		s.seedSettings,
		s.seedCategories,
		s.seedSplitRules,
		s.seedRecurrences,
		s.seedMonths,
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return err
		}
	}
	return nil
}

func (s *seeder) seedSettings() error {
	return s.svc.UpdateSettings(s.ctx, map[string]string{"partner_name": "Ana"})
}

func (s *seeder) seedCategories() error {
	s.categories = make(map[string]int64)
	for _, c := range []struct {
		name     string
		kind     domain.TransactionType
		archived bool
	}{
		{"Salário", domain.Income, false},
		{"Freelance", domain.Income, false},
		{"Moradia", domain.Expense, false},
		{"Mercado", domain.Expense, false},
		{"Transporte", domain.Expense, false},
		{"Lazer", domain.Expense, false},
		{"Saúde", domain.Expense, false},
		{"Assinaturas", domain.Expense, false},
		{"Educação", domain.Expense, false},
		{"Academia", domain.Expense, true},
	} {
		created, err := s.svc.CreateCategory(s.ctx, domain.Category{Name: c.name, Kind: c.kind})
		if err != nil {
			return fmt.Errorf("seed category %q: %w", c.name, err)
		}
		if c.archived {
			created.Archived = true
			if _, err := s.svc.UpdateCategory(s.ctx, created); err != nil {
				return fmt.Errorf("archive category %q: %w", c.name, err)
			}
		}
		s.categories[c.name] = created.ID
	}
	return nil
}

func (s *seeder) seedSplitRules() error {
	s.rules = make(map[string]*domain.SplitRule)
	for _, r := range []struct {
		name     string
		percent  int
		archived bool
	}{
		{"50/50", 50, false},
		{"30/70", 30, false},
		{"60/40", 60, true},
	} {
		created, err := s.svc.CreateSplitRule(s.ctx, domain.SplitRule{Name: r.name, MyPercent: r.percent})
		if err != nil {
			return fmt.Errorf("seed split rule %q: %w", r.name, err)
		}
		if r.archived {
			created.Archived = true
			if _, err := s.svc.UpdateSplitRule(s.ctx, created); err != nil {
				return fmt.Errorf("archive split rule %q: %w", r.name, err)
			}
		}
		s.rules[r.name] = &domain.SplitRule{ID: created.ID}
	}
	return nil
}

func (s *seeder) seedRecurrences() error {
	for _, r := range []domain.Recurrence{
		{Day: 5, Description: "Salário", Type: domain.Income, CategoryID: s.categories["Salário"], EstimatedAmount: 650000, Active: true},
		{Day: 10, Description: "Aluguel", Type: domain.Expense, CategoryID: s.categories["Moradia"], EstimatedAmount: 180000, SplitRule: s.rules["50/50"], Active: true},
		{Day: 15, Description: "Internet", Type: domain.Expense, CategoryID: s.categories["Assinaturas"], EstimatedAmount: 11990, SplitRule: s.rules["50/50"], Active: true},
		{Day: 20, Description: "Streaming", Type: domain.Expense, CategoryID: s.categories["Assinaturas"], EstimatedAmount: 3990, Active: true},
		{Day: 8, Description: "Mensalidade da academia", Type: domain.Expense, CategoryID: s.categories["Academia"], EstimatedAmount: 12900, Active: false},
	} {
		if _, err := s.svc.CreateRecurrence(s.ctx, r); err != nil {
			return fmt.Errorf("seed recurrence %q: %w", r.Description, err)
		}
	}
	return nil
}

// monthlyEntry is a one-off transaction repeated every month with a varying amount.
type monthlyEntry struct {
	day         int
	description string
	typ         domain.TransactionType
	category    string // empty for settlements
	split       string // empty for personal expenses
	amounts     []domain.Money
}

var monthlyEntries = []monthlyEntry{
	{3, "Mercado da semana", domain.Expense, "Mercado", "50/50", []domain.Money{38250, 41780, 36410, 44090, 39520, 42360}},
	{12, "Feira e padaria", domain.Expense, "Mercado", "", []domain.Money{12430, 9870, 14120, 11050, 10690, 13280}},
	{14, "Combustível", domain.Expense, "Transporte", "", []domain.Money{21000, 18500, 23400, 19900, 22100, 20700}},
	{17, "Jantar fora", domain.Expense, "Lazer", "30/70", []domain.Money{15800, 21400, 12900, 18700, 24600, 16300}},
	{22, "Farmácia", domain.Expense, "Saúde", "", []domain.Money{7650, 4390, 11220, 5880, 9140, 6320}},
	{25, "Curso online", domain.Expense, "Educação", "", []domain.Money{9900, 9900, 9900, 9900, 9900, 9900}},
	{27, "Acerto com a Ana", domain.Settlement, "", "", []domain.Money{85000, 92000, 78500, 88000, 95500, 81000}},
	{28, "Cinema e passeio", domain.Expense, "Lazer", "50/50", []domain.Money{8400, 13600, 9200, 15100, 7800, 11900}},
}

// Freelance income shows up only in some months (index 0 is the oldest).
var freelanceByMonth = map[int]domain.Money{1: 120000, 3: 85000, 5: 150000}

const (
	installmentDescription = "Notebook"
	installmentTotal       = 10
	installmentAmount      = domain.Money(45000)
	installmentDay         = 6
	// Index of the first seeded month (0 is the oldest) that carries an installment.
	installmentFirstMonth = 1
)

func (s *seeder) seedMonths() error {
	for i := 0; i < monthsToSeed; i++ {
		month := s.monthAt(i)
		if err := s.generateRecurring(month); err != nil {
			return err
		}
		if err := s.seedMonthlyEntries(i, month); err != nil {
			return err
		}
		if err := s.seedInstallment(i, month); err != nil {
			return err
		}
		if amount, ok := freelanceByMonth[i]; ok {
			if err := s.create(month, 18, "Projeto freelance", domain.Income, "Freelance", "", amount, nil); err != nil {
				return err
			}
		}
	}
	return nil
}

// monthAt returns the i-th seeded month, 0 being the oldest and the last the current one.
func (s *seeder) monthAt(i int) domain.YearMonth { return monthAt(s.today, i) }

func monthAt(now time.Time, i int) domain.YearMonth {
	t := time.Date(now.Year(), now.Month()-time.Month(monthsToSeed-1-i), 1, 0, 0, 0, 0, time.UTC)
	return domain.YearMonth{Year: t.Year(), Month: t.Month()}
}

func (s *seeder) generateRecurring(month domain.YearMonth) error {
	generation, err := s.svc.GenerateRecurring(s.ctx, month)
	if err != nil {
		return fmt.Errorf("generate recurring for %s: %w", month, err)
	}
	for _, tx := range generation.Created {
		if !s.isDue(tx.Date) {
			continue
		}
		tx.Confirmed = true
		if _, err := s.svc.UpdateTransaction(s.ctx, tx); err != nil {
			return fmt.Errorf("confirm %q: %w", tx.Description, err)
		}
	}
	return nil
}

func (s *seeder) seedMonthlyEntries(i int, month domain.YearMonth) error {
	for _, e := range monthlyEntries {
		if err := s.create(month, e.day, e.description, e.typ, e.category, e.split, e.amounts[i], nil); err != nil {
			return err
		}
	}
	return nil
}

// seedInstallment adds one installment of a 10x purchase for every month from the plan's
// first month up to the current one.
func (s *seeder) seedInstallment(i int, month domain.YearMonth) error {
	if i < installmentFirstMonth {
		return nil
	}
	number := i - installmentFirstMonth + 1
	installment := &installmentRef{number: number, total: installmentTotal}
	return s.create(month, installmentDay, installmentDescription, domain.Expense, "Lazer", "", installmentAmount, installment)
}

type installmentRef struct{ number, total int }

func (s *seeder) create(month domain.YearMonth, day int, description string, typ domain.TransactionType, category, split string, amount domain.Money, installment *installmentRef) error {
	date := dateIn(month, day)
	tx := domain.Transaction{
		Date:        date,
		Description: description,
		Type:        typ,
		Amount:      amount,
		Confirmed:   s.isDue(date),
	}
	if category != "" {
		id := s.categories[category]
		tx.CategoryID = &id
	}
	if split != "" {
		tx.SplitRule = s.rules[split]
	}
	if installment != nil {
		tx.InstallmentNumber, tx.InstallmentTotal = &installment.number, &installment.total
	}
	if _, err := s.svc.CreateTransaction(s.ctx, tx); err != nil {
		return fmt.Errorf("seed transaction %q on %s: %w", description, date.Format("2006-01-02"), err)
	}
	return nil
}

// isDue reports whether a transaction on date has already happened.
func (s *seeder) isDue(date time.Time) bool { return !date.After(s.today) }

// dateIn returns the given day of the month, clamped to its last day.
func dateIn(month domain.YearMonth, day int) time.Time {
	lastDay := time.Date(month.Year, month.Month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	return time.Date(month.Year, month.Month, min(day, lastDay), 0, 0, 0, 0, time.UTC)
}

func truncateDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
