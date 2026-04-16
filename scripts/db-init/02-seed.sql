-- 02-seed.sql
-- Sample data for development/testing.
-- Only runs on first container start (when DB is empty).

INSERT INTO users (username, phone) VALUES
    ('john_doe', '+1234567890'),
    ('jane_smith', '+0987654321'),
    ('admin_user', '+1112223333')
ON CONFLICT (username) DO NOTHING;
