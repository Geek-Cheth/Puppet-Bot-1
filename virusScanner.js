const axios = require('axios');
const FormData = require('form-data');
const db = require('./database'); // Import database functions

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_KEY;
const URLSCAN_API_KEY = process.env.URLSCAN_API_KEY || '0196f7c1-71f0-74b3-a3a2-1fc8f5f09716'; // Fallback for local dev if not in .env
const CACHE_DURATION_HOURS = 24; // Cache results for 24 hours

const VIRUSTOTAL_API_URL_SCAN = 'https://www.virustotal.com/api/v3/urls';
const VIRUSTOTAL_API_URL_REPORT = 'https://www.virustotal.com/api/v3/analyses/';
const URLSCAN_API_URL_SUBMIT = 'https://urlscan.io/api/v1/scan/';
const URLSCAN_API_URL_RESULT = 'https://urlscan.io/api/v1/result/';

/**
 * Scans a URL using the VirusTotal API.
 * @param {string} urlToScan The URL to scan.
 * @returns {Promise<string|null>} The analysis ID if submission is successful, otherwise null.
 */
async function scanUrl(urlToScan) {
    if (!VIRUSTOTAL_API_KEY) {
        console.error('VirusTotal API key is not configured.');
        return null;
    }
    try {
        const formData = new FormData();
        formData.append('url', urlToScan);
        const response = await axios.post(VIRUSTOTAL_API_URL_SCAN, formData, {
            headers: { ...formData.getHeaders(), 'x-apikey': VIRUSTOTAL_API_KEY },
        });
        return response.data?.data?.id || null;
    } catch (error) {
        console.error('Error submitting URL to VirusTotal:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Gets the report for a URL scan analysis from VirusTotal.
 * @param {string} analysisId The ID of the analysis.
 * @returns {Promise<object|null>} The analysis report, or null if an error occurs or report is not ready.
 */
async function getUrlReport(analysisId) {
    if (!VIRUSTOTAL_API_KEY) {
        console.error('VirusTotal API key is not configured.');
        return null;
    }
    try {
        const response = await axios.get(`${VIRUSTOTAL_API_URL_REPORT}${analysisId}`, {
            headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
        });
        return response.data?.data || null;
    } catch (error) {
        console.error('Error fetching URL report from VirusTotal:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Submits a URL to urlscan.io for scanning.
 * @param {string} urlToScan The URL to scan.
 * @returns {Promise<string|null>} The scan ID (UUID) if submission is successful, otherwise null.
 */
async function scanUrlWithUrlscan(urlToScan) {
    if (!URLSCAN_API_KEY) {
        console.error('urlscan.io API key is not configured.');
        return null;
    }
    try {
        const response = await axios.post(URLSCAN_API_URL_SUBMIT, 
            { url: urlToScan, visibility: 'public' },
            { headers: { 'API-Key': URLSCAN_API_KEY, 'Content-Type': 'application/json' } }
        );
        if (response.data && response.data.uuid) {
            console.log(`URL submitted to urlscan.io. Scan ID: ${response.data.uuid}`);
            return response.data.uuid;
        }
        console.error('urlscan.io API did not return a scan ID.', response.data);
        return null;
    } catch (error) {
        console.error('Error submitting URL to urlscan.io:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Retrieves the report for a URL scan from urlscan.io.
 * @param {string} scanId The ID of the urlscan.io scan.
 * @returns {Promise<object|null>} The scan report, or null if an error occurs or report is not ready.
 */
async function getUrlscanReport(scanId) {
    try {
        const response = await axios.get(`${URLSCAN_API_URL_RESULT}${scanId}/`);
        // Check if the task object and UUID match, indicating a valid report structure
        if (response.data && response.data.task && response.data.task.uuid === scanId) {
            return response.data;
        }
        // Handle cases where the report might exist but is not what we expect
        console.warn(`urlscan.io report for ${scanId} received, but task.uuid does not match or task is missing.`);
        return null;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log(`urlscan.io report for ${scanId} not found (still processing or invalid ID).`);
            return null; // 404 means report not ready or doesn't exist
        }
        console.error('Error fetching report from urlscan.io:', error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message);
        return null;
    }
}

/**
 * Checks a URL for malicious content using urlscan.io and VirusTotal as a fallback.
 * @param {string} urlToCheck The URL to check.
 * @returns {Promise<'safe' | 'malicious' | 'unknown' | 'error'>} The status of the URL.
 */
async function checkUrlMalware(urlToCheck) {
    const cachedResult = await db.getScannedUrl(urlToCheck);
    if (cachedResult) {
        const lastScannedDate = new Date(cachedResult.last_scanned_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastScannedDate.getTime()) / (1000 * 60 * 60);
        if (hoursDiff < CACHE_DURATION_HOURS) {
            console.log(`Cache hit for ${urlToCheck}. Status: ${cachedResult.status}`);
            return cachedResult.status;
        }
        console.log(`Cache expired for ${urlToCheck}. Re-scanning.`);
    }

    let finalCombinedStatus = 'unknown';
    let urlscanReportData = null;
    let urlscanScanId = null;
    let virusTotalResponse = null;
    let vtAnalysisId = null;
    let primaryScanFailed = false;
    let verdictSource = '';

    console.log(`Primary check for ${urlToCheck} with urlscan.io...`);
    urlscanScanId = await scanUrlWithUrlscan(urlToCheck);

    if (!urlscanScanId) {
        console.error(`urlscan.io submission failed for ${urlToCheck}.`);
        primaryScanFailed = true;
        urlscanReportData = { error: 'urlscan.io submission failed' };
        finalCombinedStatus = 'error'; // Error in submission
    } else {
        for (let i = 0; i < 12; i++) { // Poll for ~2 minutes (12 * 10s = 120s)
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second delay
            const report = await getUrlscanReport(urlscanScanId);
            urlscanReportData = report;

            if (report && report.task && report.task.uuid === urlscanScanId) {
                console.log(`urlscan.io report received for ${urlscanScanId}.`);
                if (report.verdicts?.overall?.malicious || report.verdicts?.urlscan?.malicious || report.verdicts?.community?.malicious) {
                    finalCombinedStatus = 'malicious';
                } else if (report.verdicts?.overall?.score === 0 && !report.verdicts?.overall?.malicious && (!report.lists || report.lists.length === 0)) {
                    finalCombinedStatus = 'safe';
                } else if (report.verdicts?.overall?.score > 0 || (report.lists && report.lists.length > 0)) {
                    finalCombinedStatus = 'unknown'; // Suspicious, needs VT
                } else {
                    finalCombinedStatus = 'unknown'; // Default if no clear signal
                }
                verdictSource = 'urlscan.io';
                break;
            } else if (report === null && i < 11) {
                console.log(`urlscan.io report for ${urlToCheck} (ID: ${urlscanScanId}) not ready. Attempt ${i + 1}.`);
            } else if (i === 11) {
                console.error(`Failed to get a conclusive report from urlscan.io for ${urlscanScanId} after multiple attempts.`);
                primaryScanFailed = true;
                if (!urlscanReportData) urlscanReportData = { error: 'urlscan.io polling timed out' };
                finalCombinedStatus = 'error'; // Error in polling
            }
        }
    }

    if (primaryScanFailed || finalCombinedStatus === 'unknown' || (finalCombinedStatus === 'error' && verdictSource !== 'urlscan.io')) {
        const reason = primaryScanFailed ? "urlscan.io check failed" : `urlscan.io status is '${finalCombinedStatus}'`;
        console.log(`${reason} for ${urlToCheck}. Proceeding to VirusTotal.`);
        
        // If urlscan.io resulted in an operational error (submission/polling), reset status for VT.
        // If urlscan.io itself determined 'error' for the URL, that's a valid status from urlscan.
        if (primaryScanFailed) finalCombinedStatus = 'unknown';


        vtAnalysisId = await scanUrl(urlToCheck);
        if (!vtAnalysisId) {
            console.error(`VirusTotal submission failed for ${urlToCheck}.`);
            // If urlscan also failed, this is a full error. Otherwise, stick with urlscan's 'unknown' if it was that.
            if (finalCombinedStatus === 'unknown' && !primaryScanFailed) {
                // urlscan was unknown, VT submission failed, overall unknown
            } else {
                 finalCombinedStatus = 'error'; // Both failed or VT submission failed after urlscan error
            }
            virusTotalResponse = { error: 'VirusTotal submission failed' };
        } else {
            for (let i = 0; i < 6; i++) { // Poll for ~1.5 minutes (6 * 15s)
                await new Promise(resolve => setTimeout(resolve, 15000));
                const report = await getUrlReport(vtAnalysisId);
                virusTotalResponse = report;
                if (report?.attributes?.status === 'completed') {
                    const stats = report.attributes.stats;
                    if (stats.malicious > 0 || stats.suspicious > 0) {
                        finalCombinedStatus = 'malicious';
                    } else if (stats.harmless > 0 && stats.malicious === 0 && stats.suspicious === 0) {
                        finalCombinedStatus = 'safe';
                    } else {
                        finalCombinedStatus = 'unknown';
                    }
                    verdictSource = 'VirusTotal';
                    break;
                } else if (report?.attributes?.status === 'queued') {
                    console.log(`VirusTotal analysis for ${urlToCheck} still queued. Attempt ${i + 1}.`);
                } else if (i === 5) {
                    console.log(`Could not get completed VirusTotal report for ${urlToCheck}. Status: ${report?.attributes?.status}.`);
                    if (finalCombinedStatus !== 'malicious' && finalCombinedStatus !== 'safe') { // If urlscan didn't give a clear result
                        finalCombinedStatus = 'unknown'; // Default to unknown if VT polling inconclusive
                    }
                    if (!virusTotalResponse) virusTotalResponse = { error: 'VirusTotal polling timed out' };
                    if (!verdictSource) verdictSource = 'VirusTotal (timeout/error)';
                }
            }
        }
    }


    const rawDbResponse = {
        source_order: primaryScanFailed ? ['urlscan.io (failed)', 'VirusTotal'] : (vtAnalysisId ? ['urlscan.io', 'VirusTotal'] : ['urlscan.io']),
        urlscan_check: urlscanReportData,
        virustotal_check: virusTotalResponse,
        final_verdict_source: verdictSource || 'unknown_source',
        final_status: finalCombinedStatus
    };

    const scanIdentifier = vtAnalysisId || urlscanScanId; // Prefer VT ID if available, else urlscan ID

    if (cachedResult) {
        await db.updateScannedUrl(urlToCheck, finalCombinedStatus, scanIdentifier, rawDbResponse);
    } else {
        await db.saveScannedUrl(urlToCheck, finalCombinedStatus, scanIdentifier, rawDbResponse);
    }

    console.log(`Final status for ${urlToCheck}: ${finalCombinedStatus} (Source: ${rawDbResponse.final_verdict_source})`);
    return finalCombinedStatus;
}

module.exports = {
    checkUrlMalware,
    scanUrl, // VirusTotal scan
    getUrlReport, // VirusTotal report
    scanUrlWithUrlscan,
    getUrlscanReport
};
