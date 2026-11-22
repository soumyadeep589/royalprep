CREATE TABLE student_practice_answers (
  owner_email text NOT NULL REFERENCES student_accounts(email),
  question_id text NOT NULL REFERENCES questions(id),
  question_version integer NOT NULL CHECK (question_version > 0),
  chapter text NOT NULL,
  stem text NOT NULL,
  selected_option integer NOT NULL CHECK (selected_option BETWEEN 0 AND 3),
  correct_option integer NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
  explanation text NOT NULL,
  answered_at bigint NOT NULL,
  PRIMARY KEY (owner_email, question_id)
);
