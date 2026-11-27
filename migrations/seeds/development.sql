INSERT INTO messages (id, data) VALUES
  (1, '{"from":"Captain","message":"Requesting permission to dock."}'),
  (2, '{"from":"Station Control","message":"Proceed to bay three."}'),
  (3, '{"from":"Engineer","message":"Docking clamps engaged."}')
ON CONFLICT (id) DO NOTHING;
