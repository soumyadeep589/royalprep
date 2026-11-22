CREATE TABLE chapter_documents (
  id text PRIMARY KEY,
  current_revision integer NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  draft_revision integer,
  published_revision integer
);

CREATE TABLE chapter_revisions (
  chapter_id text NOT NULL REFERENCES chapter_documents(id),
  revision integer NOT NULL CHECK (revision > 0),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chapter_id, revision)
);

CREATE TABLE student_chapter_progress (
  owner_email text NOT NULL REFERENCES student_accounts(email),
  chapter_id text NOT NULL REFERENCES chapter_documents(id),
  revision integer NOT NULL,
  section_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_email, chapter_id),
  FOREIGN KEY (chapter_id, revision) REFERENCES chapter_revisions(chapter_id, revision)
);
