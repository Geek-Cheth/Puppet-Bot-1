CREATE TABLE IF NOT EXISTS scanned_urls (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'safe', 'malicious', 'unknown', 'error'
    last_scanned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    virustotal_analysis_id TEXT, -- Store the analysis ID from VirusTotal
    raw_response JSONB, -- Store the full VirusTotal response if needed for future reference
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Index on URL for faster lookups
CREATE INDEX IF NOT EXISTS idx_scanned_urls_url ON scanned_urls(url);

-- Optional: Function to update 'updated_at' timestamp automatically
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_scanned_urls
BEFORE UPDATE ON scanned_urls
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE scanned_urls IS 'Stores results of URL malware scans to cache VirusTotal API calls.';
COMMENT ON COLUMN scanned_urls.status IS 'The determined status of the URL (safe, malicious, unknown, error).';
COMMENT ON COLUMN scanned_urls.last_scanned_at IS 'Timestamp of when the URL was last actively scanned via VirusTotal.';
COMMENT ON COLUMN scanned_urls.virustotal_analysis_id IS 'The analysis ID from the VirusTotal API for this URL scan.';
COMMENT ON COLUMN scanned_urls.raw_response IS 'The full JSON response from VirusTotal for the scan analysis.';
