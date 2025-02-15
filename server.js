const express = require("express");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const fetchRoute = require("./routes/fetchMail");
const sendRoute = require("./routes/sendEmail");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({limit: "50mb"}));
app.use(cookieParser()); 
app.use(express.urlencoded({limit: "50mb", extended: true }));

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

app.use("/emails/fetch", fetchRoute);
app.use("/emails/send", sendRoute);

// Generate authentication URL
app.get("/auth", (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",  // Add this scope
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/calendar",
        ],
    });

    res.redirect(authUrl);
});

// Handle OAuth callback
app.get("/oauth/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send("Authorization code is missing.");
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        res.cookie("access_token", tokens.access_token, { httpOnly: true, secure: true });
        res.cookie("refresh_token", tokens.refresh_token, { httpOnly: true, secure: true });

        res.json({Access_token : tokens.access_token});
        //res.send("Authentication successful");
    } catch (err) {
        console.error("Error exchanging code for tokens:", err.response ? err.response.data : err);
        res.status(500).send("Authentication failed");
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
