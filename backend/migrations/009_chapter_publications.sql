CREATE TABLE chapter_publications (
  chapter_id text NOT NULL,
  revision integer NOT NULL,
  published_at timestamptz DEFAULT now(),
  source_revision integer,
  PRIMARY KEY (chapter_id, revision),
  FOREIGN KEY (chapter_id, revision) REFERENCES chapter_revisions(chapter_id, revision),
  FOREIGN KEY (chapter_id, source_revision) REFERENCES chapter_revisions(chapter_id, revision)
);

INSERT INTO chapter_publications (chapter_id, revision, published_at)
SELECT id, published_revision, NULL FROM chapter_documents WHERE published_revision IS NOT NULL;
