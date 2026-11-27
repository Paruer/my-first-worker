CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL CHECK (
    json_valid(data)
    AND json_type(data, '$.from') IS 'text'
    AND json_type(data, '$.message') IS 'text'
  )
);
