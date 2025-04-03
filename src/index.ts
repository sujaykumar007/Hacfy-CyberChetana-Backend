import express from "express";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

import nodemailer from "nodemailer";
import cors from "cors";
import bodyParser from "body-parser";
import { Buffer } from "buffer";

import chromium from "chrome-aws-lambda"
import findChrome from "chrome-finder";
dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());

app.use(express.json());
app.use(bodyParser.json());

// ✅ Test Database Connection
async function testDB() {
  try {
    await prisma.$connect();
    console.log("✅ Database Connected Successfully");
  } catch (error) {
    console.error("❌ Database Connection Failed:", error);
    process.exit(1);
  }
}
testDB();

// ✅ Configure Nodemailer
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


// export const generatePDF = async (htmlContent: string): Promise<Buffer> => {
//   try {
//     console.log("🟡 Starting Puppeteer...");

//     const browser = await puppeteer.launch({
//       executablePath:
//         process.env.RENDER
//           ? "/usr/bin/chromium"
//           : "C:\\Users\\info\\.cache\\puppeteer\\chrome\\win64-134.0.6998.165\\chrome-win64\\chrome.exe",
//       headless: false, // Use "new" for latest versions
//       args:
//      ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
//     });


 
//     console.log("✅ Puppeteer launched successfully");

//     const page = await browser.newPage();
//     await page.setContent(htmlContent, { waitUntil: "networkidle0" });

//     const pdfBuffer = await page.pdf({ format: "a4" });

//     await browser.close();
//     return Buffer.from(pdfBuffer);
//   } catch (error: any) {
//     console.error("❌ PDF generation failed:", error);
//     throw new Error("PDF generation failed: " + error.message);
//   }
// };
export const generatePDF = async (htmlContent: string): Promise<Buffer> => {
  try {
    console.log("🟡 Starting Puppeteer...");

    const browser = await puppeteer.launch({
      executablePath: process.env.RENDER
        ? "/usr/bin/chromium"
        : "C:\\Users\\info\\.cache\\puppeteer\\chrome\\win64-134.0.6998.165\\chrome-win64\\chrome.exe",
      headless: true, // Use "new" for latest Puppeteer versions
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process"
      ],
    });

    console.log("✅ Puppeteer launched successfully");

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({ format: "a4" });

    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch (error: any) {
    console.error("❌ PDF generation failed:", error);
    throw new Error("PDF generation failed: " + error.message);
  }
};

app.post("/register", async (req :any, res :any) => {
  try {
    console.log("📩 Received Registration Request:", req.body);

    const { firstName, lastName, email, phoneNumber } = req.body;

    if (!firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Check if user exists
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

    // ✅ Send Email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Your Registration Certificate",
      text: "Attached is your certificate of registration.",
      attachments: [{ filename: "certificate.pdf", content: pdfBuffer, contentType: "application/pdf" }],
    });

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
