-- Migration: Consolidate Case/Document statuses to MVP model
-- Date: 2026-03-13
--
-- Targets:
--   Case statuses -> intake | awaiting_client | in_progress | closed
--   Document statuses -> requested | received | accepted | not_requested
--
-- Safe to run multiple times.

BEGIN;

-- 1) Normalize case.status values
UPDATE cases
SET
    status = CASE lower(replace(status, ' ', '_'))
        WHEN 'intake' THEN 'intake'
        WHEN 'awaiting_client' THEN 'awaiting_client'
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'closed' THEN 'closed'

        WHEN 'document_collection' THEN 'awaiting_client'
        WHEN 'additional_documents_requested' THEN 'awaiting_client'
        WHEN 'rfe_received' THEN 'awaiting_client'

        WHEN 'document_review' THEN 'in_progress'
        WHEN 'application_prep' THEN 'in_progress'
        WHEN 'in_preparation' THEN 'in_progress'
        WHEN 'ready_to_submit' THEN 'in_progress'
        WHEN 'ready_to_file' THEN 'in_progress'
        WHEN 'submitted' THEN 'in_progress'
        WHEN 'filed' THEN 'in_progress'
        WHEN 'under_review' THEN 'in_progress'
        WHEN 'decision_pending' THEN 'in_progress'
        WHEN 'biometrics_scheduled' THEN 'in_progress'
        WHEN 'interview_scheduled' THEN 'in_progress'
        WHEN 'rfe_response_drafting' THEN 'in_progress'

        WHEN 'approved' THEN 'closed'
        WHEN 'refused' THEN 'closed'
        WHEN 'withdrawn' THEN 'closed'

        ELSE status
    END,
    updated_at = NOW()
WHERE status IS NOT NULL
  AND status <> CASE lower(replace(status, ' ', '_'))
        WHEN 'intake' THEN 'intake'
        WHEN 'awaiting_client' THEN 'awaiting_client'
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'closed' THEN 'closed'

        WHEN 'document_collection' THEN 'awaiting_client'
        WHEN 'additional_documents_requested' THEN 'awaiting_client'
        WHEN 'rfe_received' THEN 'awaiting_client'

        WHEN 'document_review' THEN 'in_progress'
        WHEN 'application_prep' THEN 'in_progress'
        WHEN 'in_preparation' THEN 'in_progress'
        WHEN 'ready_to_submit' THEN 'in_progress'
        WHEN 'ready_to_file' THEN 'in_progress'
        WHEN 'submitted' THEN 'in_progress'
        WHEN 'filed' THEN 'in_progress'
        WHEN 'under_review' THEN 'in_progress'
        WHEN 'decision_pending' THEN 'in_progress'
        WHEN 'biometrics_scheduled' THEN 'in_progress'
        WHEN 'interview_scheduled' THEN 'in_progress'
        WHEN 'rfe_response_drafting' THEN 'in_progress'

        WHEN 'approved' THEN 'closed'
        WHEN 'refused' THEN 'closed'
        WHEN 'withdrawn' THEN 'closed'

        ELSE status
    END;

-- 2) Normalize case_documents.status values
UPDATE case_documents
SET
    status = CASE lower(replace(replace(status, ' ', '_'), '-', '_'))
        WHEN 'requested' THEN 'requested'
        WHEN 'received' THEN 'received'
        WHEN 'accepted' THEN 'accepted'
        WHEN 'not_requested' THEN 'not_requested'

        WHEN 'pending' THEN 'requested'
        WHEN 'needs_revision' THEN 'requested'
        WHEN 'rejected' THEN 'requested'
        WHEN 'expired' THEN 'requested'

        WHEN 'under_review' THEN 'received'
        WHEN 'review' THEN 'received'

        WHEN 'approved' THEN 'accepted'
        WHEN 'completed' THEN 'accepted'

        WHEN 'optional' THEN 'not_requested'

        ELSE status
    END,
    updated_at = NOW()
WHERE status IS NOT NULL
  AND status <> CASE lower(replace(replace(status, ' ', '_'), '-', '_'))
        WHEN 'requested' THEN 'requested'
        WHEN 'received' THEN 'received'
        WHEN 'accepted' THEN 'accepted'
        WHEN 'not_requested' THEN 'not_requested'

        WHEN 'pending' THEN 'requested'
        WHEN 'needs_revision' THEN 'requested'
        WHEN 'rejected' THEN 'requested'
        WHEN 'expired' THEN 'requested'

        WHEN 'under_review' THEN 'received'
        WHEN 'review' THEN 'received'

        WHEN 'approved' THEN 'accepted'
        WHEN 'completed' THEN 'accepted'

        WHEN 'optional' THEN 'not_requested'

        ELSE status
    END;

-- 3) Set canonical default for new case_documents rows
ALTER TABLE case_documents
    ALTER COLUMN status SET DEFAULT 'requested';

-- 4) Normalize cases.custom_fields.document_status_overrides (JSON object)
WITH normalized_overrides AS (
    SELECT
        c.id,
        COALESCE(
            jsonb_object_agg(
                entry.key,
                CASE lower(replace(replace(entry.value, ' ', '_'), '-', '_'))
                    WHEN 'requested' THEN 'requested'
                    WHEN 'received' THEN 'received'
                    WHEN 'accepted' THEN 'accepted'
                    WHEN 'not_requested' THEN 'not_requested'

                    WHEN 'pending' THEN 'requested'
                    WHEN 'needs_revision' THEN 'requested'
                    WHEN 'rejected' THEN 'requested'
                    WHEN 'expired' THEN 'requested'

                    WHEN 'under_review' THEN 'received'
                    WHEN 'review' THEN 'received'

                    WHEN 'approved' THEN 'accepted'
                    WHEN 'completed' THEN 'accepted'

                    WHEN 'optional' THEN 'not_requested'

                    ELSE entry.value
                END
            ),
            '{}'::jsonb
        ) AS normalized
    FROM cases c
    JOIN LATERAL (
        SELECT e.key, e.value
        FROM jsonb_each_text(c.custom_fields -> 'document_status_overrides') e
    ) entry ON jsonb_typeof(c.custom_fields -> 'document_status_overrides') = 'object'
    GROUP BY c.id
)
UPDATE cases c
SET
    custom_fields = jsonb_set(c.custom_fields, '{document_status_overrides}', normalized_overrides.normalized, true),
    updated_at = NOW()
FROM normalized_overrides
WHERE c.id = normalized_overrides.id
  AND (c.custom_fields -> 'document_status_overrides') IS DISTINCT FROM normalized_overrides.normalized;

-- 5) Normalize cases.custom_fields.custom_documents[*].status (JSON array objects)
WITH normalized_custom_docs AS (
    SELECT
        c.id,
        jsonb_agg(
            CASE
                WHEN jsonb_typeof(item.elem) = 'object' AND item.elem ? 'status' THEN
                    jsonb_set(
                        item.elem,
                        '{status}',
                        to_jsonb(
                            CASE lower(replace(replace(item.elem ->> 'status', ' ', '_'), '-', '_'))
                                WHEN 'requested' THEN 'requested'
                                WHEN 'received' THEN 'received'
                                WHEN 'accepted' THEN 'accepted'
                                WHEN 'not_requested' THEN 'not_requested'

                                WHEN 'pending' THEN 'requested'
                                WHEN 'needs_revision' THEN 'requested'
                                WHEN 'rejected' THEN 'requested'
                                WHEN 'expired' THEN 'requested'

                                WHEN 'under_review' THEN 'received'
                                WHEN 'review' THEN 'received'

                                WHEN 'approved' THEN 'accepted'
                                WHEN 'completed' THEN 'accepted'

                                WHEN 'optional' THEN 'not_requested'

                                ELSE item.elem ->> 'status'
                            END
                        ),
                        true
                    )
                ELSE item.elem
            END
            ORDER BY item.ord
        ) AS normalized
    FROM cases c
    JOIN LATERAL (
        SELECT elem, ord
        FROM jsonb_array_elements(c.custom_fields -> 'custom_documents') WITH ORDINALITY AS arr(elem, ord)
    ) item ON jsonb_typeof(c.custom_fields -> 'custom_documents') = 'array'
    GROUP BY c.id
)
UPDATE cases c
SET
    custom_fields = jsonb_set(c.custom_fields, '{custom_documents}', normalized_custom_docs.normalized, true),
    updated_at = NOW()
FROM normalized_custom_docs
WHERE c.id = normalized_custom_docs.id
  AND (c.custom_fields -> 'custom_documents') IS DISTINCT FROM normalized_custom_docs.normalized;

COMMIT;

-- Optional rollback helper (manual, not automatic):
-- If you need historical granularity back, restore from a pre-migration backup.
-- Multiple old statuses are intentionally collapsed to one canonical status.
