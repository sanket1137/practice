-- Add SlotPlayKey column for impression deduplication
-- This column stores SHA256(screenId + date + slot + second) to prevent duplicate impressions

-- Add SlotPlayKey column
ALTER TABLE "Impressions" ADD COLUMN IF NOT EXISTS "SlotPlayKey" TEXT;

-- Create unique index on SlotPlayKey (allows NULL for legacy data)
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Impressions_SlotPlayKey" 
ON "Impressions" ("SlotPlayKey") 
WHERE "SlotPlayKey" IS NOT NULL;

-- Create index on ImpressionId for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Impressions_ImpressionId" 
ON "Impressions" ("ImpressionId") 
WHERE "ImpressionId" IS NOT NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Impressions' 
AND column_name IN ('SlotPlayKey', 'ImpressionId');

-- Show index info
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Impressions' 
AND indexname LIKE '%SlotPlayKey%' OR indexname LIKE '%ImpressionId%';
