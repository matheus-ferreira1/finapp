package app

import (
	"context"
	"regexp"
	"strings"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

var currencyCode = regexp.MustCompile(`^[A-Z]{3}$`)

var supportedLocales = map[string]bool{"pt-BR": true, "en": true}

func (s *Service) Settings(ctx context.Context) (map[string]string, error) {
	return s.store.Settings(ctx)
}

// UpdateSettings validates every value before writing any, so a bad request changes nothing.
func (s *Service) UpdateSettings(ctx context.Context, settings map[string]string) error {
	normalized := make(map[string]string, len(settings))
	for key, value := range settings {
		switch key {
		case "partner_name":
			value = strings.TrimSpace(value)
			if len(value) > 100 {
				return domain.ErrInvalidSetting
			}
		case "currency":
			if !currencyCode.MatchString(value) {
				return domain.ErrInvalidSetting
			}
		case "locale":
			if !supportedLocales[value] {
				return domain.ErrInvalidSetting
			}
		default:
			return domain.ErrInvalidSetting
		}
		normalized[key] = value
	}

	for key, value := range normalized {
		if err := s.store.SetSetting(ctx, key, value); err != nil {
			return err
		}
	}
	return nil
}
