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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use(express_1.default.json());
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const generateCertificateHTML = (firstName, lastName) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
    .certificate { border: 5px solid black; padding: 50px; display: inline-block; }
    h1 { font-size: 24px; }
    p { font-size: 18px; }
  </style>
</head>
<body>
  <div class="certificate">
    <h1>Certificate of Registration</h1>
    <p>This is to certify that</p>
    <h2>${firstName} ${lastName}</h2>
    <p>has successfully registered.</p>
  </div>
</body>
</html>
`;
const generatePDF = (htmlContent, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield puppeteer_1.default.launch();
    const page = yield browser.newPage();
    yield page.setContent(htmlContent);
    const pdfPath = path_1.default.join(__dirname, `certificate_${userId}.pdf`);
    yield page.pdf({ path: pdfPath, format: "A4" });
    yield browser.close();
    return pdfPath;
});
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, email, password } = req.body;
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const user = yield prisma.user.create({
            data: { firstName, lastName, email, password: hashedPassword },
        });
        const htmlContent = generateCertificateHTML(firstName, lastName);
        const pdfPath = yield generatePDF(htmlContent, user.id);
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Your Registration Certificate",
            text: "Attached is your certificate of registration.",
            attachments: [{ filename: "certificate.pdf", path: pdfPath }],
        };
        yield transporter.sendMail(mailOptions);
        res.json({ message: "User registered, PDF sent to email", user });
    }
    catch (error) {
        res.status(500).json({ error: "Registration failed" });
    }
}));
app.listen(3000, () => console.log("Server running on port 3000"));
