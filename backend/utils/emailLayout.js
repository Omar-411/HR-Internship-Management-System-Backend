// Common email layout for all emails sent by the system
export const wrapEmailContent = (bodyHtml) => {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px; text-align: center;">

    <!-- Logo at the top -->
    <img src="https://i.ibb.co/67G9BYWg/dotjcom-logo.png" alt="HRcoM Logo" style="width: 150px; margin-bottom: 20px;" />

    <!-- Dynamic email content based on the purpose of the email -->
    <div style="text-align: left; font-size: 16px; color: #555; line-height: 1.5;">
      ${bodyHtml}
    </div>

    <!-- Best regards -->
    <p style="margin-top: 40px; font-size: 16px; color: #333; text-align: left;">
      Best regards,<br/>
      <strong>The HRcoM Team</strong>
    </p>

    <!-- Cover image at the end -->
    <img src="https://i.ibb.co/4Rdtq18n/dotjcom-cover.png" alt="HRcoM Cover" style="width: 100%; margin-top: 20px;" />
  </div>
  `;
};