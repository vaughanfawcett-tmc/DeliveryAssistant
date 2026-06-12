-- Migration: 0002_voice_recording_url
-- Phase 4 schema addition: recording_url column on calls table
-- D-08: provider recording URL set on call_ended; null in mock; 30-day retention

alter table calls add column recording_url text;
