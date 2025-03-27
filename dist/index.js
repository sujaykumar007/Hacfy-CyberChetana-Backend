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
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
// Middleware
app.use((0, cors_1.default)({
    origin: "http://localhost:3000", // Change in production
    methods: "GET,POST",
    credentials: true,
}));
app.use(express_1.default.json());
app.use(body_parser_1.default.json());
// Configure Nodemailer
const transporter = nodemailer_1.default.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use TLS encryption
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use App Password if needed
    },
});
// Generate Certificate HTML
const generateCertificateHTML = (firstName, lastName) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Internship</title>
  <style>
      body {
          font-family: 'Times New Roman', serif;
          text-align: center;
          padding: 50px;
          background-color: #f8f9fa;
      }
      .certificate-container {
          width: 800px;
          height: 600px;
          background: white;
          padding: 50px;
          border: 10px solid #2c3e50;
          display: inline-block;
          position: relative;
      }
      .certificate-title {
          font-size: 32px;
          font-weight: bold;
          text-transform: uppercase;
          color: #2c3e50;
      }
      .certificate-subtitle {
          font-size: 20px;
          text-transform: uppercase;
          margin-bottom: 20px;
          color: #34495e;
      }
      .certificate-body {
          font-size: 18px;
          margin-top: 20px;
      }
      .certificate-name {
          font-size: 28px;
          font-weight: bold;
          font-style: italic;
          margin-top: 10px;
          color: #2c3e50;
      }
      .certificate-footer {
          margin-top: 50px;
          font-size: 16px;
          display: flex;
          justify-content: space-between;
          padding: 0 50px;
      }
      .certificate-footer div {
          width: 40%;
          border-top: 2px solid black;
          padding-top: 5px;
          text-align: center;
      }
      .seal {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
      }
  </style>
</head>
<body>
  <div class="certificate-container">
      <h1 class="certificate-title">Certificate of Internship</h1>
      <p class="certificate-subtitle">This Certificate is proudly presented to</p>
      <p class="certificate-name">${firstName} ${lastName}</p>
      <p class="certificate-body">
          in recognition of their outstanding completion of the internship program <br>
          at [Company Name] from [Start Date] to [End Date].
      </p>
      <img class="seal" src="https://upload.wikimedia.org/wikipedia/commons/6/6a/Seal_of_Certification.svg" alt="Seal">
      <div class="certificate-footer">
          <div>
              <p>Date</p>
              [Date]
          </div>
          <div>
              <p>Signature</p>
              [Authorized Signatory]
          </div>
      </div>
  </div>
</body>
</html>
`;
// Generate PDF in Memory (No File Storage)
const generatePDF = (htmlContent) => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield puppeteer_1.default.launch({
        headless: true, // Use headless true for servers
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = yield browser.newPage();
    yield page.setContent(htmlContent);
    // Generate PDF in memory and force-cast to Buffer
    const pdfBuffer = (yield page.pdf({ format: "A4" }));
    yield browser.close();
    return pdfBuffer;
});
// Register Endpoint
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, email, phoneNumber } = req.body;
        // Check if user already exists
        const existingUser = yield prisma.user.findUnique({ where: { email: email } });
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use" });
        }
        // Create user
        const user = yield prisma.user.create({
            data: { firstName, lastName, email, phoneNumber },
        });
        // Generate Certificate PDF
        const htmlContent = generateCertificateHTML(firstName, lastName);
        const pdfBuffer = yield generatePDF(htmlContent);
        // Send Email with PDF (without storing PDF on disk)
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Your Registration Certificate",
            text: "Attached is your certificate of registration.",
            attachments: [
                {
                    filename: "certificate.pdf",
                    content: pdfBuffer, // pdfBuffer is a Buffer now
                    contentType: "application/pdf",
                },
            ],
        };
        yield transporter.sendMail(mailOptions);
        res.json({ message: "User registered, PDF sent to email", user });
    }
    catch (error) {
        console.error("❌ Registration failed:", error);
        res.status(500).json({ error: "Registration failed" });
    }
}));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
