-- Allow service role full access to leads (used by Vercel serverless functions)
CREATE POLICY "Service role full access to leads"
  ON leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role full access to email_outreach
CREATE POLICY "Service role full access to email_outreach"
  ON email_outreach FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
