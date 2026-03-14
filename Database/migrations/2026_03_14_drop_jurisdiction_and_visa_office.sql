-- Migration: Remove deprecated jurisdiction and visa_office columns
-- Date: 2026-03-14
--
-- Safe to run multiple times.

BEGIN;

ALTER TABLE user_profiles
    DROP COLUMN IF EXISTS jurisdiction;

ALTER TABLE cases
    DROP COLUMN IF EXISTS visa_office;

COMMIT;
