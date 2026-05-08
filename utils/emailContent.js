// --- This file contains the personalized content of the emails sent by the system. --- //

// Email of adding a new user
export const getAddUserContent = ({ name, password, code }) => {
  return `
    <h2 style="color: #232ED1;">Welcome to HRcoM!</h2>

    <p>Dear ${name},</p>
    <p>
      We are truly excited to have you on board among us in HRcoM!
    </p>

    <p> 
      Your account has been created successfully! Please use the following credentials to login: </br>
      <strong> Password: </strong> ${password} </br>
      <strong> OTP Code: </strong> ${code} </br>
      <strong>Platform URL:</strong> 
      <a href=${process.env.PLATFORM_URL} target="_blank" style="color: #232ED1; text-decoration: underline; text-align: center; font-weight: bold;">
        HRcoM Platform
      </a>
    </p>

    <p> <strong> Please note that for security reasons, this verification code will expire in 24 hours! </strong> </p>
  
    <p> <strong> Next Steps: </strong> </p>
    <p> 
      1. Go to the HRcoM platform via the link above. </br>
      2. Log in using your email and the temporary password provided above. </br>
      3. Enter the verification code when prompted to activate your account. </br>
      4. Reset your password. </br>
    </p>

    <p> <strong> Important Notes: </strong> </p>
    <p>
      - Do not share this email or your credentials with anyone. </br>
    </p>

    <p> <strong> We are glad to have you on board and look forward to achieving great things together! </strong> </p>
  `;
};

// Email of updating an existing user if the role is changed
export const getUpdateUserContent = ({ name, newRole }) => {
  return `
    <h2 style="color: #232ED1;">Role Update Notification!</h2>

    <p>Dear ${name},</p>
    <p>
      We are pleased to inform you that you have been promoted to 
      <strong>${newRole}</strong>.
    </p>
    <p>
      Congratulations on this achievement! This reflects your hard work and contributions to our team.
    </p>
    <p>We are truly excited to see you grow further with us!</p>
    </br>
  `;
};

// Email of resending OTP code
export const getResendOTPContent = ({ name, code }) => {
  return `
    <h2 style="color: #232ED1;">OTP Code Sending request!</h2>

    <p> Dear ${name},</p>
    <p>You requested a new verification code to activate your HRcoM account.</p>
    <p>Your new verification code is:</p>
    <p><strong style="color: #232ED1;">OTP Code: </strong> ${code}</p>

    Please note that this code will expire in 24 hours!
  `;
};

// Email of forget password validation link
export const getForgetPasswordValidationContent = ({ name, resetLink }) => {
  return `
    <h2 style="color: #232ED1;">Password Reset Request!</h2>

    <p> Dear ${name},</p>
    <p>You requested a password reset for your HRcoM account.</p>

    <p>Please click the link below to reset your password:</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${resetLink}" target="_blank" 
        style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #232ED1;
          color: #ffffff;
          text-decoration: none;
          font-weight: bold;
          border-radius: 6px;
          font-family: Arial, sans-serif;
          font-size: 16px;
        ">
        Reset Password
      </a>
    </div>
  
    <p><strong>Please note that this link will expire in 1 Hour!</strong></p>
    
    <p>If you did not request this, please ignore this email!</p>
  `;
};

// Email of sending the generated document to the user
export const getDocumentEmailContent = ({ name, documentTitle }) => {
  return `
    <h2 style="color: #232ED1;">
      Official Document Notification
    </h2>

    <p>Dear ${name},</p>

    <p>
      We are pleased to inform you that your document,
      <strong>${documentTitle}</strong>,
      has been successfully generated and is now available.
    </p>

    <p>
      Please find the document attached to this email for your records and use.
    </p>

    <p>
      Should you require any additional information or assistance regarding this document,
      please do not hesitate to contact us.
    </p>
  `;
};
