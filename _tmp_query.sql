SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'PlayerPairingTokens';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'PlayerPairingTokens';
