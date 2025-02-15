const express = require("express");
const { google } = require("googleapis");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        // Get access token from cookies
        const accessToken = req.cookies.access_token;
        if (!accessToken) return res.status(401).json({ msg: "Access token is missing" });

        // Set the OAuth client's credentials
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        // Fetch list of emails
        const response = await gmail.users.messages.list({
            userId: "me",
            maxResults: 2,
        });

        const messages = response.data.messages || [];
        if (messages.length === 0) return res.json({ msg: "No messages found" });

        // Fetch email details
        const emailData = await Promise.all(
            messages.map(async (msg) => {
                const email = await gmail.users.messages.get({
                    userId: "me",
                    id: msg.id,
                });

                // Extract headers (e.g., subject, sender)
                const headers = email.data.payload.headers;
                const subject = headers.find(header => header.name === "Subject")?.value || "No Subject";
                const from = headers.find(header => header.name === "From")?.value || "Unknown Sender";

                // Extract email body (decode if base64 encoded)
                let body = "No Body";
                if (email.data.payload.body?.data) {
                    body = Buffer.from(email.data.payload.body.data, "base64").toString();
                } else if (email.data.payload.parts) {
                    const textPart = email.data.payload.parts.find(part => part.mimeType === "text/plain");
                    if (textPart?.body?.data) {
                        body = Buffer.from(textPart.body.data, "base64").toString();
                    }
                }

                return {
                    id: msg.id,
                    snippet: email.data.snippet, // Short preview of the email
                    subject,
                    from,
                    body,
                    labelIds: email.data.labelIds,
                };
            })
        );

        res.json(emailData);
    } catch (error) {
        console.error("Error fetching emails:", error);
        res.status(500).json({ msg: "Error fetching emails" });
    }
});

module.exports = router;
