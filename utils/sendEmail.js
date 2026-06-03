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
  getPositionUpdateContent,
  getFaceResetContent,
  getPayslipGenerationRequestContent,
  getPayslipGenerationConfirmationContent,
} from "./emailContent.js";

export const sendEmail = async ({
  to,
  subject,
  type,
  name,
  email,
  month,
  year,
  password,
  code,
  resetLink,
  newRole,
  newPosition,
  documentTitle,
  attachments = [],
}) => {
  let bodyHtml;

  // Decide the email content based on type
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

    case "positionUpdate":
      bodyHtml = getPositionUpdateContent({ name, newPosition });
      break;

    case "faceIdReset":
      bodyHtml = getFaceResetContent({ name });
      break;

    case "payslipGenerationRequest":
      bodyHtml = getPayslipGenerationRequestContent({ name, email, month, year });
      break;

    case "payslipGenerationConfirmation":
      bodyHtml = getPayslipGenerationConfirmationContent({ name, month, year });
      break;

    default:
      bodyHtml = `<p>Default message</p>`;
  }

  const htmlContent = wrapEmailContent(bodyHtml);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"HRcoM" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
      attachments,
    });

    console.log("Email sent to:", to);
  } catch (err) {
    console.error("Email sending failed:", err.message);
  }
};
