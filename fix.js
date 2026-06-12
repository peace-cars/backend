const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client(process.env.DIRECT_DATABASE_URL);
client.connect().then(() => {
  return client.query(`
    DROP VIEW IF EXISTS staff_leaderboard_stats;
    DROP VIEW IF EXISTS branch_roster_view;

    CREATE OR REPLACE VIEW staff_leaderboard_stats AS 
    SELECT 
        p.id as staff_id, 
        p.full_name, 
        p.avatar_url, 
        p.branch_id, 
        p.is_inspector_verified, 
        p.gamification_points, 
        (SELECT COUNT(*) FROM trade_in_requests t WHERE t.assigned_staff_id = p.id AND t.status IN ('ACCEPTED', 'OFFER_MADE')) AS total_deals_closed, 
        (SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM staff_reviews r WHERE r.staff_id = p.id) AS average_rating, 
        (SELECT COUNT(*) FROM staff_reviews r WHERE r.staff_id = p.id) AS review_count 
    FROM profiles p 
    WHERE p.is_verified = TRUE;

    CREATE OR REPLACE VIEW branch_roster_view AS
    SELECT
        p.id AS staff_id,
        p.full_name,
        p.avatar_url,
        p.phone_number,
        p.role_id,
        p.branch_id,
        b.name AS branch_name,
        (SELECT COUNT(*) FROM staff_shifts s WHERE s.staff_id = p.id AND s.is_active = TRUE) > 0 AS is_online,
        (SELECT clocked_in_at FROM staff_shifts s WHERE s.staff_id = p.id AND s.is_active = TRUE ORDER BY clocked_in_at DESC LIMIT 1) AS shift_started_at,
        (SELECT COUNT(*) FROM trade_in_requests t WHERE t.assigned_staff_id = p.id AND t.status IN ('NEW_LEAD', 'INSPECTION_PENDING')) AS active_inspections,
        (SELECT COUNT(*) FROM trade_in_requests t WHERE t.assigned_staff_id = p.id AND t.status IN ('ACCEPTED', 'OFFER_MADE')) AS total_deals_closed,
        (SELECT COALESCE(ROUND(AVG(r.rating), 1), 0) FROM staff_reviews r WHERE r.staff_id = p.id) AS average_rating
    FROM profiles p
    LEFT JOIN branches b ON p.branch_id = b.id
    WHERE p.is_verified = TRUE;
  `);
}).then(() => {
  console.log('Fixed views');
}).catch(e => {
  console.error(e);
}).finally(() => client.end());
