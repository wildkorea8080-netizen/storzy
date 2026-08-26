ALTER TABLE brand_profile_revisions
  ADD COLUMN onboarding_idempotency_key text;

CREATE UNIQUE INDEX brand_profile_revision_onboarding_idempotency
  ON brand_profile_revisions(brand_profile_id, onboarding_idempotency_key)
  WHERE onboarding_idempotency_key IS NOT NULL;
