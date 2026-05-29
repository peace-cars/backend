-- 1. Atomic upvote increment for community posts
CREATE OR REPLACE FUNCTION increment_community_upvotes(post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE community_posts
  SET upvotes = coalesce(upvotes, 0) + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic RSVP increment for community events
CREATE OR REPLACE FUNCTION increment_event_rsvp(event_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE community_events
  SET rsvp_count = coalesce(rsvp_count, 0) + 1
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomic Ledger Transaction (Header + Entries)
CREATE OR REPLACE FUNCTION post_ledger_transaction(
  p_description text,
  p_ref_type text,
  p_ref_id uuid,
  p_entries jsonb
) RETURNS uuid AS $$
DECLARE
  v_transaction_id uuid;
  v_entry jsonb;
BEGIN
  -- Insert transaction header
  INSERT INTO transactions (description, reference_type, reference_id)
  VALUES (p_description, p_ref_type, p_ref_id)
  RETURNING id INTO v_transaction_id;

  -- Loop through entries and insert
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    INSERT INTO ledger_entries (transaction_id, account_id, type, amount)
    VALUES (
      v_transaction_id, 
      (v_entry->>'account_id')::uuid, 
      v_entry->>'type', 
      (v_entry->>'amount')::numeric
    );
  END LOOP;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
