package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/domain"
)

// badRequest is an error caused by a malformed request, as opposed to a domain rule.
type badRequest string

func (e badRequest) Error() string { return string(e) }

// action handles a request and returns the status and body to send, or an error.
type action func(r *http.Request) (status int, body any, err error)

type api struct {
	svc *app.Service
}

// handle turns an action into an http.HandlerFunc with uniform JSON responses and errors.
func (a *api) handle(fn action) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, body, err := fn(r)
		if err != nil {
			writeError(w, err)
			return
		}
		if body == nil {
			w.WriteHeader(status)
			return
		}
		writeJSON(w, status, body)
	}
}

func writeError(w http.ResponseWriter, err error) {
	var bad badRequest
	switch {
	case errors.As(err, &bad), errors.Is(err, domain.ErrValidation):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, domain.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	case errors.Is(err, domain.ErrDuplicate), errors.Is(err, domain.ErrSplitRuleInUse):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	default:
		log.Printf("internal error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
}

// decode reads a JSON body, rejecting unknown fields and oversized payloads.
func decode(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return badRequest("invalid JSON body: " + err.Error())
	}
	return nil
}

func pathID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		return 0, badRequest("invalid id")
	}
	return id, nil
}
