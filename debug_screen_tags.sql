-- Check screen details
SELECT id, name, latitude, longitude, last_tagged_at, last_tagged_latitude, last_tagged_longitude 
FROM screens 
WHERE id = '1391940c-04f6-4ed5-b967-c73253351b16';

-- Check tags assigned to this screen
SELECT 
    sta.screen_id,
    st.slug,
    st.display_name,
    st.category,
    sta.source,
    sta.score,
    sta.distance_meters,
    sta.poi_count,
    sta.is_primary,
    sta.assigned_at
FROM screen_tag_assignments sta
JOIN screen_tags st ON sta.tag_id = st.id
WHERE sta.screen_id = '1391940c-04f6-4ed5-b967-c73253351b16'
ORDER BY sta.score DESC;

-- Check total master tags available
SELECT COUNT(*) as total_master_tags FROM screen_tags WHERE is_deleted = false;

-- Check if there are any tags with matching google place types
SELECT slug, display_name, category, google_place_types, max_distance_meters, min_poi_count
FROM screen_tags 
WHERE is_deleted = false 
AND google_place_types IS NOT NULL
LIMIT 20;
