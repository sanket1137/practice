-- Fix existing creatives with 0x0 dimensions
-- Run this script to update creatives to have default Full HD dimensions (1920x1080)

-- Option 1: Update ALL creatives with 0 dimensions to 1920x1080
UPDATE Creatives 
SET Width = 1920, Height = 1080 
WHERE Width = 0 OR Height = 0;

-- Option 2: Update specific creatives (if you know the exact dimensions they should have)
-- UPDATE Creatives 
-- SET Width = 1920, Height = 1080 
-- WHERE Id = 'your-creative-id-here';

-- Verify the update
SELECT Id, Name, Width, Height, CreatedAt 
FROM Creatives 
ORDER BY CreatedAt DESC;
