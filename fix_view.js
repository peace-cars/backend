require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE OR REPLACE VIEW district_overview AS
SELECT 
    d.id AS district_id,
    d.name AS district_name,
    d.code AS district_code,
    d.manager_id,
    dm.full_name AS manager_name,
    dm.phone_number AS manager_phone,
    (SELECT COUNT(*) FROM branches b WHERE b.district_id = d.id) AS active_branches,
    (SELECT COUNT(*) FROM branches b WHERE b.district_id = d.id) AS total_branches,
    (SELECT COUNT(*) FROM profiles p 
     JOIN branches b ON p.branch_id = b.id 
     WHERE b.district_id = d.id AND p.is_verified = true) AS total_staff,
    (SELECT COUNT(*) FROM vehicles v 
     JOIN branches b ON v.branch_id = b.id 
     WHERE b.district_id = d.id AND v.status = 'SHOWROOM') AS showroom_vehicles,
    (SELECT COUNT(*) FROM trade_in_requests t 
     JOIN branches b ON t.branch_id = b.id 
     WHERE b.district_id = d.id AND t.status IN ('NEW_LEAD', 'INSPECTION_PENDING', 'MANAGER_REVIEW')) AS active_leads,
    (SELECT COALESCE(SUM(sb.amount_requested), 0) FROM staff_budgets sb 
     JOIN profiles p ON sb.requester_id = p.id 
     JOIN branches b ON p.branch_id = b.id 
     WHERE b.district_id = d.id AND sb.status IN ('REQUESTED', 'APPROVED')) AS pending_budget_total
FROM districts d
LEFT JOIN profiles dm ON d.manager_id = dm.id;
`;

client.connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log('View updated successfully');
    process.exit(0);
  })
  .catch(e => {
    console.error('Failed to update view:', e.message);
    process.exit(1);
  });
