-- Create user if not exists
CREATE USER novogramm_user WITH PASSWORD 'novogramm_password';

-- Create database
CREATE DATABASE novogramm_db OWNER novogramm_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE novogramm_db TO novogramm_user;

-- Connect to the new database and set search_path
\c novogramm_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO novogramm_user;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO novogramm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO novogramm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO novogramm_user;
