-- Update round 2 date from 2026-03-14 to 2026-03-15
UPDATE tournaments SET date = '2026-03-15' WHERE round_number = 2;

-- Insert rounds 3-10
INSERT INTO tournaments (name, round_number, date) VALUES
  ('3a Prova Rànquing Vendrell', 3, '2026-04-12'),
  ('4a Prova Rànquing Vendrell', 4, '2026-05-10'),
  ('5a Prova Rànquing Vendrell', 5, '2026-06-28'),
  ('6a Prova Rànquing Vendrell', 6, '2026-07-26'),
  ('7a Prova Rànquing Vendrell', 7, '2026-09-06'),
  ('8a Prova Rànquing Vendrell', 8, '2026-10-04'),
  ('9a Prova Rànquing Vendrell', 9, '2026-10-18'),
  ('10a Prova Rànquing Vendrell', 10, '2026-11-22')
ON CONFLICT DO NOTHING;