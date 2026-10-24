package httpapi_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// seed creates one income category, one expense category and a 50/50 rule, returning their ids.
func seed(t *testing.T, c *client) (salary, housing, half int) {
	t.Helper()
	create := func(path string, body obj) int {
		status, resp := c.do("POST", path, body)
		if status != http.StatusCreated {
			t.Fatalf("POST %s = %d %v", path, status, resp)
		}
		return int(asObj(t, resp)["id"].(float64))
	}
	salary = create("/api/categories", obj{"name": "Salary", "kind": "income"})
	housing = create("/api/categories", obj{"name": "Housing", "kind": "expense"})
	half = create("/api/split-rules", obj{"name": "50/50", "my_percent": 50})
	return salary, housing, half
}

func TestCategoriesAndSplitRules(t *testing.T) {
	c := newClient(t)

	status, resp := c.do("POST", "/api/categories", obj{"name": "Food", "kind": "expense"})
	if status != http.StatusCreated || asObj(t, resp)["name"] != "Food" || asObj(t, resp)["id"] == nil {
		t.Fatalf("create = %d %v", status, resp)
	}
	id := int(asObj(t, resp)["id"].(float64))

	tests := []struct {
		name       string
		method     string
		path       string
		body       any
		wantStatus int
	}{
		{"duplicate", "POST", "/api/categories", obj{"name": "Food", "kind": "expense"}, http.StatusConflict},
		{"blank name", "POST", "/api/categories", obj{"name": " ", "kind": "expense"}, http.StatusBadRequest},
		{"invalid kind", "POST", "/api/categories", obj{"name": "x", "kind": "settlement"}, http.StatusBadRequest},
		{"unknown field", "POST", "/api/categories", obj{"name": "x", "kind": "expense", "color": "red"}, http.StatusBadRequest},
		{"malformed json", "POST", "/api/categories", `{"name":`, http.StatusBadRequest},
		{"rename", "PUT", fmt.Sprintf("/api/categories/%d", id), obj{"name": "Groceries", "kind": "expense"}, http.StatusOK},
		{"kind is immutable", "PUT", fmt.Sprintf("/api/categories/%d", id), obj{"name": "Groceries", "kind": "income"}, http.StatusBadRequest},
		{"unknown id", "PUT", "/api/categories/999", obj{"name": "x", "kind": "expense"}, http.StatusNotFound},
		{"non numeric id", "PUT", "/api/categories/abc", obj{"name": "x", "kind": "expense"}, http.StatusBadRequest},
		{"split percent out of range", "POST", "/api/split-rules", obj{"name": "bad", "my_percent": 150}, http.StatusBadRequest},
		{"split rule", "POST", "/api/split-rules", obj{"name": "30/70", "my_percent": 30}, http.StatusCreated},
		{"duplicate split rule", "POST", "/api/split-rules", obj{"name": "30/70", "my_percent": 30}, http.StatusConflict},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, resp := c.do(tt.method, tt.path, tt.body)
			if status != tt.wantStatus {
				t.Fatalf("status = %d (%v), want %d", status, resp, tt.wantStatus)
			}
			if status >= 400 && asObj(t, resp)["error"] == nil {
				t.Errorf("error response has no message: %v", resp)
			}
		})
	}

	t.Run("archived are hidden unless requested", func(t *testing.T) {
		c.do("PUT", fmt.Sprintf("/api/categories/%d", id), obj{"name": "Groceries", "kind": "expense", "archived": true})
		_, active := c.do("GET", "/api/categories", nil)
		_, all := c.do("GET", "/api/categories?archived=true", nil)
		if len(asList(t, active)) != 0 || len(asList(t, all)) != 1 {
			t.Fatalf("active = %v, all = %v", active, all)
		}
	})

	t.Run("lists split rules", func(t *testing.T) {
		_, rules := c.do("GET", "/api/split-rules", nil)
		if got := asList(t, rules); len(got) != 1 || asObj(t, got[0])["my_percent"].(float64) != 30 {
			t.Fatalf("rules = %v", rules)
		}
	})
}

func TestTransactions(t *testing.T) {
	c := newClient(t)
	salary, housing, half := seed(t, c)

	rent := obj{
		"date": "2026-11-03", "description": "Rent", "type": "expense", "category_id": housing,
		"amount_cents": 100001, "split_rule_id": half, "installment_number": 2, "installment_total": 12, "confirmed": true,
	}
	status, resp := c.do("POST", "/api/transactions", rent)
	if status != http.StatusCreated {
		t.Fatalf("create = %d %v", status, resp)
	}
	created := asObj(t, resp)
	id := int(created["id"].(float64))

	t.Run("response has computed my and shared amounts", func(t *testing.T) {
		if created["my_cents"].(float64) != 50001 || created["shared_cents"].(float64) != 50000 {
			t.Errorf("my/shared = %v/%v, want 50001/50000", created["my_cents"], created["shared_cents"])
		}
		if created["date"] != "2026-11-03" || created["installment_number"].(float64) != 2 || created["confirmed"] != true {
			t.Errorf("created = %v", created)
		}
	})

	t.Run("settlement needs no category", func(t *testing.T) {
		status, resp := c.do("POST", "/api/transactions", obj{"date": "2026-11-20", "type": "settlement", "amount_cents": 5000})
		if status != http.StatusCreated || asObj(t, resp)["category_id"] != nil || asObj(t, resp)["my_cents"].(float64) != 0 {
			t.Fatalf("settlement = %d %v", status, resp)
		}
	})

	t.Run("list by month", func(t *testing.T) {
		_, resp := c.do("GET", "/api/transactions?month=2026-11", nil)
		if got := asList(t, resp); len(got) != 2 {
			t.Fatalf("got %d transactions, want 2", len(got))
		}
		_, resp = c.do("GET", "/api/transactions?month=2026-10", nil)
		if got := asList(t, resp); len(got) != 0 {
			t.Fatalf("got %d transactions in October, want 0 (and a JSON array, not null)", len(got))
		}
	})

	t.Run("update", func(t *testing.T) {
		upd := rent
		upd["amount_cents"], upd["split_rule_id"], upd["confirmed"] = 20000, nil, false
		status, resp := c.do("PUT", fmt.Sprintf("/api/transactions/%d", id), upd)
		got := asObj(t, resp)
		if status != http.StatusOK || got["amount_cents"].(float64) != 20000 || got["shared_cents"].(float64) != 0 || got["confirmed"] != false {
			t.Fatalf("update = %d %v", status, resp)
		}
	})

	tests := []struct {
		name       string
		method     string
		path       string
		body       any
		wantStatus int
		wantError  string
	}{
		{"missing month", "GET", "/api/transactions", nil, 400, "month"},
		{"invalid month", "GET", "/api/transactions?month=11/2026", nil, 400, "YYYY-MM"},
		{"malformed date", "POST", "/api/transactions", obj{"date": "03/11/2026", "type": "expense", "category_id": housing, "amount_cents": 1}, 400, "YYYY-MM-DD"},
		{"income category on an expense", "POST", "/api/transactions", obj{"date": "2026-11-03", "type": "expense", "category_id": salary, "amount_cents": 1}, 400, "kind"},
		{"unknown category", "POST", "/api/transactions", obj{"date": "2026-11-03", "type": "expense", "category_id": 999, "amount_cents": 1}, 400, "unknown"},
		{"zero amount", "POST", "/api/transactions", obj{"date": "2026-11-03", "type": "expense", "category_id": housing, "amount_cents": 0}, 400, "amount"},
		{"update unknown", "PUT", "/api/transactions/999", rent, 404, "not found"},
		{"delete", "DELETE", fmt.Sprintf("/api/transactions/%d", id), nil, 204, ""},
		{"delete again", "DELETE", fmt.Sprintf("/api/transactions/%d", id), nil, 404, "not found"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, resp := c.do(tt.method, tt.path, tt.body)
			if status != tt.wantStatus {
				t.Fatalf("status = %d (%v), want %d", status, resp, tt.wantStatus)
			}
			if tt.wantError != "" {
				if msg, _ := asObj(t, resp)["error"].(string); !strings.Contains(msg, tt.wantError) {
					t.Errorf("error = %q, want it to mention %q", msg, tt.wantError)
				}
			}
		})
	}
}

func TestRecurrencesAndGeneration(t *testing.T) {
	c := newClient(t)
	salary, housing, half := seed(t, c)

	for _, rec := range []obj{
		{"day": 5, "description": "Salary", "type": "income", "category_id": salary, "estimated_amount_cents": 500000, "active": true},
		{"day": 31, "description": "Electricity", "type": "expense", "category_id": housing, "estimated_amount_cents": 18000, "split_rule_id": half, "active": true},
		{"day": 10, "description": "Old gym", "type": "expense", "category_id": housing, "estimated_amount_cents": 9000, "active": false},
	} {
		if status, resp := c.do("POST", "/api/recurrences", rec); status != http.StatusCreated {
			t.Fatalf("create recurrence = %d %v", status, resp)
		}
	}

	t.Run("list ordered by day", func(t *testing.T) {
		_, resp := c.do("GET", "/api/recurrences", nil)
		got := asList(t, resp)
		if len(got) != 3 || asObj(t, got[0])["description"] != "Salary" || asObj(t, got[2])["description"] != "Electricity" {
			t.Fatalf("recurrences = %v", resp)
		}
	})

	t.Run("generate", func(t *testing.T) {
		status, resp := c.do("POST", "/api/recurrences/generate", obj{"month": "2026-11"})
		got := asObj(t, resp)
		created := asList(t, got["created"])
		if status != http.StatusOK || len(created) != 2 || got["skipped"].(float64) != 0 {
			t.Fatalf("generate = %d %v", status, resp)
		}
		last := asObj(t, created[1])
		if last["date"] != "2026-11-30" || last["confirmed"] != false || last["recurrence_month"] != "2026-11" || last["shared_cents"].(float64) != 9000 {
			t.Errorf("generated = %v", last)
		}
	})

	t.Run("generating again creates nothing", func(t *testing.T) {
		_, resp := c.do("POST", "/api/recurrences/generate", obj{"month": "2026-11"})
		got := asObj(t, resp)
		if len(asList(t, got["created"])) != 0 || got["skipped"].(float64) != 2 {
			t.Fatalf("second generate = %v", resp)
		}
	})

	t.Run("invalid month", func(t *testing.T) {
		if status, _ := c.do("POST", "/api/recurrences/generate", obj{"month": "nov"}); status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", status)
		}
	})

	t.Run("validation", func(t *testing.T) {
		bad := obj{"day": 40, "description": "x", "type": "expense", "category_id": housing, "estimated_amount_cents": 1, "active": true}
		if status, _ := c.do("POST", "/api/recurrences", bad); status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", status)
		}
	})

	t.Run("update and delete", func(t *testing.T) {
		_, resp := c.do("GET", "/api/recurrences", nil)
		first := asObj(t, asList(t, resp)[0])
		id := int(first["id"].(float64))
		first["estimated_amount_cents"] = 600000
		status, upd := c.do("PUT", fmt.Sprintf("/api/recurrences/%d", id), first)
		if status != http.StatusOK || asObj(t, upd)["estimated_amount_cents"].(float64) != 600000 {
			t.Fatalf("update = %d %v", status, upd)
		}
		if status, _ := c.do("DELETE", fmt.Sprintf("/api/recurrences/%d", id), nil); status != http.StatusNoContent {
			t.Fatalf("delete status = %d, want 204", status)
		}
		if status, _ := c.do("DELETE", fmt.Sprintf("/api/recurrences/%d", id), nil); status != http.StatusNotFound {
			t.Fatalf("second delete status = %d, want 404", status)
		}
	})
}

func TestSplitRuleInUseConflict(t *testing.T) {
	c := newClient(t)
	_, housing, half := seed(t, c)
	c.do("POST", "/api/transactions", obj{"date": "2026-11-03", "type": "expense", "category_id": housing, "amount_cents": 1000, "split_rule_id": half})

	status, resp := c.do("PUT", fmt.Sprintf("/api/split-rules/%d", half), obj{"name": "50/50", "my_percent": 60})
	if status != http.StatusConflict {
		t.Fatalf("status = %d %v, want 409", status, resp)
	}
}

func TestReports(t *testing.T) {
	c := newClient(t)
	_, housing, half := seed(t, c)
	for _, tx := range []obj{
		{"date": "2026-01-05", "type": "expense", "category_id": housing, "amount_cents": 20000, "split_rule_id": half, "confirmed": true},
		{"date": "2026-01-06", "type": "expense", "category_id": housing, "amount_cents": 1000},
		{"date": "2026-01-07", "type": "settlement", "amount_cents": 4000, "confirmed": true},
	} {
		if status, resp := c.do("POST", "/api/transactions", tx); status != http.StatusCreated {
			t.Fatalf("setup = %d %v", status, resp)
		}
	}

	t.Run("monthly", func(t *testing.T) {
		status, resp := c.do("GET", "/api/reports/monthly?year=2026", nil)
		body := asObj(t, resp)
		months := asList(t, body["months"])
		if status != http.StatusOK || body["year"].(float64) != 2026 || len(months) != 12 {
			t.Fatalf("monthly = %d %v", status, resp)
		}
		jan := asObj(t, months[0])
		planned, realized := asObj(t, jan["planned"]), asObj(t, jan["realized"])
		gross, mine := asObj(t, planned["gross"]), asObj(t, planned["mine"])

		checks := []struct {
			name      string
			got, want float64
		}{
			{"month", jan["month"].(float64), 1},
			{"planned gross income (settlement counts)", gross["income_cents"].(float64), 4000},
			{"planned gross expense", gross["expense_cents"].(float64), 21000},
			{"planned gross balance", gross["balance_cents"].(float64), -17000},
			{"planned mine expense", mine["expense_cents"].(float64), 11000},
			{"planned shared", planned["shared_cents"].(float64), 10000},
			{"planned settled", planned["settled_cents"].(float64), 4000},
			{"planned owed", planned["owed_cents"].(float64), 6000},
			{"planned owed to date", planned["owed_to_date_cents"].(float64), 6000},
			{"realized gross expense (confirmed only)", asObj(t, realized["gross"])["expense_cents"].(float64), 20000},
		}
		for _, ck := range checks {
			if ck.got != ck.want {
				t.Errorf("%s = %v, want %v", ck.name, ck.got, ck.want)
			}
		}
	})

	t.Run("categories", func(t *testing.T) {
		tests := []struct {
			query     string
			wantTotal float64
		}{
			{"year=2026&view=gross&scope=all", 21000},
			{"year=2026&view=mine&scope=all", 11000},
			{"year=2026&view=gross&scope=confirmed", 20000},
			{"year=2026", 21000}, // defaults: gross, all
		}
		for _, tt := range tests {
			status, resp := c.do("GET", "/api/reports/categories?"+tt.query, nil)
			rows := asList(t, asObj(t, resp)["rows"])
			if status != http.StatusOK || len(rows) != 1 {
				t.Fatalf("%s = %d %v", tt.query, status, resp)
			}
			row := asObj(t, rows[0])
			months := asList(t, row["months"])
			if row["name"] != "Housing" || row["total_cents"].(float64) != tt.wantTotal || len(months) != 12 || months[0].(float64) != tt.wantTotal {
				t.Errorf("%s: row = %v, want Housing total %v", tt.query, row, tt.wantTotal)
			}
		}
	})

	t.Run("invalid parameters", func(t *testing.T) {
		for _, path := range []string{
			"/api/reports/monthly", "/api/reports/monthly?year=abc", "/api/reports/monthly?year=0",
			"/api/reports/categories?year=2026&view=net", "/api/reports/categories?year=2026&scope=some",
		} {
			if status, _ := c.do("GET", path, nil); status != http.StatusBadRequest {
				t.Errorf("GET %s = %d, want 400", path, status)
			}
		}
	})
}

func TestSettings(t *testing.T) {
	c := newClient(t)

	status, resp := c.do("GET", "/api/settings", nil)
	got := asObj(t, resp)
	if status != http.StatusOK || got["currency"] != "BRL" || got["locale"] != "pt-BR" || got["partner_name"] != "" {
		t.Fatalf("defaults = %d %v", status, resp)
	}

	status, resp = c.do("PUT", "/api/settings", obj{"partner_name": "Ana", "locale": "en"})
	got = asObj(t, resp)
	if status != http.StatusOK || got["partner_name"] != "Ana" || got["locale"] != "en" || got["currency"] != "BRL" {
		t.Fatalf("update = %d %v", status, resp)
	}

	if status, _ := c.do("PUT", "/api/settings", obj{"currency": "reais"}); status != http.StatusBadRequest {
		t.Fatalf("invalid currency status = %d, want 400", status)
	}
}

func TestInternalErrorsAreNotLeaked(t *testing.T) {
	c := newClient(t)
	_ = c.store.Close() // every query now fails

	status, resp := c.do("GET", "/api/categories", nil)
	if status != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", status)
	}
	if msg := asObj(t, resp)["error"].(string); msg != "internal error" {
		t.Errorf("error = %q, want a generic message", msg)
	}
}
