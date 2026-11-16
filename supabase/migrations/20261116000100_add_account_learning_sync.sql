ALTER TABLE learning_state
  ADD COLUMN IF NOT EXISTS learner_level TEXT
  CHECK (learner_level IN ('beginner', 'intermediate', 'advanced'));

ALTER TABLE learning_state
  ADD COLUMN IF NOT EXISTS coach_state JSONB NOT NULL
  DEFAULT '{"attempts":[],"reviews":[]}'::jsonb;

ALTER TABLE learning_state
  ADD COLUMN IF NOT EXISTS practice_notes JSONB NOT NULL
  DEFAULT '[]'::jsonb;
