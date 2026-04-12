-- Migration 0008: Remove obsolete telemetry config keys.
DELETE FROM `config`
WHERE `key` IN ('telemetry_asked', 'telemetry_enabled');
