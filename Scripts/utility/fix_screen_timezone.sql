-- Update existing screen timezone from UTC to Asia/Kolkata
-- Screen ID: 481757f0-fcf2-4910-b6fb-378f0b9e9b1a

UPDATE "Screens" 
SET "Timezone" = 'Asia/Kolkata', "UpdatedAt" = NOW()
WHERE "Id" = '481757f0-fcf2-4910-b6fb-378f0b9e9b1a';

-- Verify the update
SELECT "Id", "Name", "Timezone", "UpdatedAt" 
FROM "Screens" 
WHERE "Id" = '481757f0-fcf2-4910-b6fb-378f0b9e9b1a';
