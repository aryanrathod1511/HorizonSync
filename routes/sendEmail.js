const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const upload = multer({ dest: "uploads/", limits: { fileSize: 50 * 1024 * 1024 } });

// **Declare oauth2Client at the beginning**
const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

// Function to send email with attachment
async function sendEmail(auth, to, subject, body, filePath) {
    try {
        // **Use oauth2Client here**
        const gmail = google.gmail({ version: "v1", auth });

        let attachment = "";
        let fileName = "";
        let fileMimeType = "application/octet-stream";

        if (filePath) {
            attachment = fs.readFileSync(filePath).toString("base64");
            fileName = path.basename(filePath);
            //fileMimeType = "application/pdf"; // Adjust based on actual file type
        }

        const boundary = "boundary123";
        let emailLines = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "MIME-Version: 1.0",
            `Content-Type: multipart/mixed; boundary=${boundary}`,
            "",
            `--${boundary}`,
            "Content-Type: text/plain; charset=UTF-8",
            "",
            body,
        ];

        if (filePath) {
            emailLines.push(
                "",
                `--${boundary}`,
                `Content-Type: ${fileMimeType}; name="${fileName}"`,
                `Content-Disposition: attachment; filename="${fileName}"`,
                "Content-Transfer-Encoding: base64",
                "",
                attachment
            );
        }

        emailLines.push(`--${boundary}--`, "");
        const emailContent = emailLines.join("\n");

        const encodedMessage = Buffer.from(emailContent)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage },
        });

        console.log("Email sent successfully:", response.data);

        if (filePath) {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
        }

        return response.data;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

// **Fix here: Pass oauth2Client instead of auth**
router.post("/", upload.single("file"), async (req, res) => {
    try {
        const { to, subject, body } = req.body;
        const filePath = req.file ? req.file.path : null;

        const accessToken = req.cookies.access_token;
        oauth2Client.setCredentials({ access_token: accessToken });
        

        if (!accessToken) {
            return res.status(401).json({ error: "Access token missing" });
        }

        oauth2Client.setCredentials({ access_token: accessToken });

        await sendEmail(oauth2Client, to, subject, body, filePath);

        res.status(200).json({ message: "Email sent successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to send email" });
    }
});

module.exports = router;
