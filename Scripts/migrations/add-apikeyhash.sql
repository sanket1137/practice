-- Add ApiKeyHash column to Screens table
ALTER TABLE Screens
ADD ApiKeyHash NVARCHAR(MAX) NULL;

GO
