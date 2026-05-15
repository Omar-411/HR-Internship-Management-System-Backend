import nodemailer from "nodemailer";
import { wrapEmailContent } from "./emailLayout.js";
import {
  getAddUserContent,
  getUpdateUserContent,
  getResendOTPContent,
  getForgetPasswordValidationContent,
  getDocumentEmailContent,
  getAccountReactivationContent,
  getAccountDeactivationContent,
} from "./emailContent.js";

export const sendEmail = async ({
  to,
  subject,
  type,
  name,
  password,
  code,
  resetLink,
  newRole,
  documentTitle,
  attachments = [],
}) => {
  let bodyHtml;

  // Decide the content based on type
  switch (type) {
    case "addUser":
      bodyHtml = getAddUserContent({ name, password, code });
      break;

    case "updateUser":
      bodyHtml = getUpdateUserContent({ name, newRole });
      break;

    case "resendOTP":
      bodyHtml = getResendOTPContent({ name, code });
      break;

    case "forgetPasswordRequest":
      bodyHtml = getForgetPasswordValidationContent({ name, resetLink });
      break;
    case "document":
      bodyHtml = getDocumentEmailContent({
        name,
        documentTitle,
      });
      break;
    case "accountReactivation":
      bodyHtml = getAccountReactivationContent({ name });
      break;
    case "accountDeactivation":
      bodyHtml = getAccountDeactivationContent({ name });
      break;
    default:
      bodyHtml = `<p>Default message</p>`;
  }

  const htmlContent = wrapEmailContent(bodyHtml);

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"HRcoM" <${process.env.ETHEREAL_USER}>`,
      to,
      subject,
      html: htmlContent,
      attachments,
    });

    console.log("Onboarding email sent to:", to);
  } catch (err) {
    console.error("Email sending failed:", err.message);
  }
};
