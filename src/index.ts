import express from "express";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import nodemailer from "nodemailer";
import cors from "cors";
import bodyParser from "body-parser";
import { Buffer } from "buffer";
dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors({ origin: "https://cyberchetana.hacfy.com/" }))
app.use(express.json());
app.use(bodyParser.json());

// ✅ Test Database Connection Before Starting
async function testDB() {
  try {
    await prisma.$connect();
    console.log("✅ Database Connected Successfully");
  } catch (error) {
    console.error("❌ Database Connection Failed:", error);
    process.exit(1); // Exit if database fails
  }
}
testDB();

// ✅ Configure Nodemailer (Ensure .env has correct values)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Generate Certificate HTML
const generateCertificateHTML = (firstName: string, lastName: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Internship</title>
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
      <h1 class="certificate-title">Certificate of Internship</h1>
      <p class="certificate-subtitle">This Certificate is proudly presented to</p>
      <p class="certificate-name">${firstName} ${lastName}</p>
      <p class="certificate-body">in recognition of their outstanding completion of the internship program.</p>
      <div class="certificate-footer">
          <div><p>Date</p>[Date]</div>
          <div><p>Signature</p>[Authorized Signatory]</div>
      </div>
  </div>
</body>
</html>
`;
export const generatePDF = async (htmlContent: string): Promise<Buffer> => {
  try {
    console.log("🟡 Starting Puppeteer...");

    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome-stable",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-software-rasterizer"
      ]
    });

    console.log("✅ Puppeteer launched successfully");
    
    const page = await browser.newPage();
    console.log("✅ New page created");

    await page.setContent(htmlContent);
    console.log("✅ HTML content set");

    const pdfBuffer = await page.pdf({ format: "A4" });
    console.log("✅ PDF generated successfully");

    await browser.close();

    return Buffer.from(pdfBuffer); // ✅ Convert Uint8Array to Buffer

  } catch (error: unknown) {
    console.error("❌ PDF generation failed:", error);
    
    if (error instanceof Error) {
        throw new Error("PDF generation failed: " + error.message);
    } else {
        throw new Error("PDF generation failed: Unknown error occurred");
    }
}

};


app.post("/register", async (req :any, res :any) => {
  try {
    console.log("📩 Received Registration Request:", req.body);

    const { firstName, lastName, email, phoneNumber } = req.body;

    if (!firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // ✅ Create user in database
    const user = await prisma.user.create({
      data: { firstName, lastName, email, phoneNumber },
    });
    console.log("✅ User Created:", user);

    // ✅ Generate Certificate PDF
    const htmlContent = generateCertificateHTML(firstName, lastName);
    const pdfBuffer = await generatePDF(htmlContent);

    // ✅ Send Email with PDF
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Your Registration Certificate",
      text: "Attached is your certificate of registration.",
      attachments: [{ filename: "certificate.pdf", content: pdfBuffer, contentType: "application/pdf" }],
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email Sent to:", user.email);

    res.json({ message: "User registered, PDF sent to email", user });
  } catch (error: any) {
    console.error("❌ Registration failed:", error);
    res.status(500).json({ error: `Registration failed: ${error.message}` });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
