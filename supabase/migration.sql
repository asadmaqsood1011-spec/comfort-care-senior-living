-- Run this once in Supabase SQL Editor to create tables

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  preferred_community VARCHAR(255) NOT NULL,
  care_type VARCHAR(80) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status VARCHAR(40) NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_outreach (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Demo Sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
