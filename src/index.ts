import express from "express";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import nodemailer from "nodemailer";
import cors from "cors";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const prisma = new PrismaClient();


app.use(
  cors({
    origin: "http://localhost:3000", 
    methods: "GET,POST",
    credentials: true,
  })
);
app.use(express.json());
app.use(bodyParser.json());

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use TLS encryption
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use App Password if needed
  },
});

// Generate Certificate HTML
const generateCertificateHTML = (firstName: string, lastName: string) => `
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
const generatePDF = async (htmlContent: string): Promise<Buffer> => {
  const browser = await puppeteer.launch({
    headless: true, // Use headless true for servers
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent)

  // Generate PDF in memory and force-cast to Buffer
  const pdfBuffer = (await page.pdf({ format: "A4" })) as Buffer;

  await browser.close();
  return pdfBuffer;
};

// Register Endpoint
app.post("/register", async (req: any, res: any) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user .findUnique({ where: { email: email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Create user
    const user = await prisma.user.create({
      data: { firstName, lastName, email, phoneNumber },
    });

    // Generate Certificate PDF
    const htmlContent = generateCertificateHTML(firstName, lastName);
    const pdfBuffer = await generatePDF(htmlContent);

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

    await transporter.sendMail(mailOptions);

    res.json({ message: "User registered, PDF sent to email", user });
  } catch (error) {
    console.error("❌ Registration failed:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
