"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePDF = void 0;
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const buffer_1 = require("buffer");
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(body_parser_1.default.json());
// ✅ Test Database Connection
function testDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prisma.$connect();
            console.log("✅ Database Connected Successfully");
        }
        catch (error) {
            console.error("❌ Database Connection Failed:", error);
            process.exit(1);
        }
    });
}
testDB();
// ✅ Configure Nodemailer
const transporter = nodemailer_1.default.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
// ✅ Generate Certificate HTML
const generateCertificateHTML = (firstName, lastName) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Completion</title>
  <style>
      body { font-family: 'Times New Roman', serif; text-align: center; padding: 50px; background-color: #f8f9fa; }
      .certificate-container { width: 800px; height: 600px; background: white; padding: 50px; border: 10px solid #2c3e50; display: inline-block; position: relative; }
      .certificate-title { font-size: 32px; font-weight: bold; text-transform: uppercase; color: #2c3e50; }
      .certificate-subtitle { font-size: 20px; text-transform: uppercase; margin-bottom: 20px; color: #34495e; }
      .certificate-body { font-size: 18px; margin-top: 20px; }
      .certificate-name { font-size: 28px; font-weight: bold; font-style: italic; margin-top: 10px; color: #2c3e50; }
      .certificate-footer { margin-top: 50px; font-size: 16px; display: flex; justify-content: space-between; padding: 0 50px; }
      .certificate-footer div { width: 40%; border-top: 2px solid black; padding-top: 5px; text-align: center; }
  </style>
</head>
<body>
  <div class="certificate-container">
      <h1 class="certificate-title">Certificate of Completion</h1>
      <p class="certificate-subtitle">This Certificate is proudly presented to</p>
      <p class="certificate-name">${firstName} ${lastName}</p>
      <p class="certificate-body">for successfully completing the course.</p>
      <div class="certificate-footer">
          <div><p>Date</p>[Date]</div>
          <div><p>Signature</p>[Authorized Signatory]</div>
      </div>
  </div>
</body>
</html>
`;
const generatePDF = (htmlContent) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("🟡 Starting Puppeteer...");
        const browser = yield puppeteer_core_1.default.launch({
            executablePath: process.env.RENDER
                ? "/usr/bin/chromium"
                : "C:\\Users\\info\\.cache\\puppeteer\\chrome\\win64-134.0.6998.165\\chrome-win64\\chrome.exe",
            headless: false, // Use "new" for latest versions
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        });
        console.log("✅ Puppeteer launched successfully");
        const page = yield browser.newPage();
        yield page.setContent(htmlContent, { waitUntil: "networkidle0" });
        const pdfBuffer = yield page.pdf({ format: "a4" });
        yield browser.close();
        return buffer_1.Buffer.from(pdfBuffer);
    }
    catch (error) {
        console.error("❌ PDF generation failed:", error);
        throw new Error("PDF generation failed: " + error.message);
    }
});
exports.generatePDF = generatePDF;
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📩 Received Registration Request:", req.body);
        const { firstName, lastName, email, phoneNumber } = req.body;
        if (!firstName || !lastName || !email || !phoneNumber) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        // ✅ Check if user exists
        const existingUser = yield prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use" });
        }
        // ✅ Create user in database
        const user = yield prisma.user.create({
            data: { firstName, lastName, email, phoneNumber },
        });
        console.log("✅ User Created:", user);
        // ✅ Generate Certificate PDF
        const htmlContent = generateCertificateHTML(firstName, lastName);
        const pdfBuffer = yield (0, exports.generatePDF)(htmlContent);
        // ✅ Send Email
        yield transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Your Registration Certificate",
            text: "Attached is your certificate of registration.",
            attachments: [{ filename: "certificate.pdf", content: pdfBuffer, contentType: "application/pdf" }],
        });
        console.log("✅ Email Sent to:", user.email);
        res.json({ message: "User registered, PDF sent to email", user });
    }
    catch (error) {
        console.error("❌ Registration failed:", error);
        res.status(500).json({ error: `Registration failed: ${error.message}` });
    }
}));
// ✅ Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
