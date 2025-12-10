-- Fix creative file URLs to use correct port (5257 instead of 5000)
UPDATE Creatives 
SET FileUrl = REPLACE(FileUrl, 'http://localhost:5000/uploads', 'http://localhost:5257/uploads')
WHERE FileUrl LIKE 'http://localhost:5000/uploads%';

-- Verify the update
SELECT Id, Name, FileUrl, CreatedAt 
FROM Creatives 
ORDER BY CreatedAt DESC;
