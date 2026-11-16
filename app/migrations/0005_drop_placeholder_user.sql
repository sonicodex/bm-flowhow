-- Phase 4.1: login replaces the placeholder user of phases 2 and 3.
-- Its tour runs, visits and reviews were made by an invented user under
-- rules that have since changed; moving them to a real account would mark
-- as reviewed a flow that person never walked. They are deleted with it
-- (ON DELETE CASCADE on tour_runs, tour_visits and review_records).
-- It is found by its username and its empty password hash, which no real
-- account has.
DELETE FROM users WHERE username = 'usuario de prueba' AND password_hash = '';
