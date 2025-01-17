const nodemailer = require('nodemailer');

const getFrontendUrl = () => {
	return process.env.NODE_ENV === 'production' 
		? process.env.FRONTEND_URL 
		: 'http://localhost:3001';
};

// Configure nodemailer with better timeout and connection settings
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // Add connection timeout settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,   // 5 seconds
    socketTimeout: 10000,    // 10 seconds
    // Add debug for logging
    debug: true,
    logger: true,
    // Add TLS options
    tls: {
        rejectUnauthorized: false // Helps with self-signed certificates
    },
    // Add pool settings
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5
});

// Verify transporter connection on startup
transporter.verify(function (error, success) {
    if (error) {
        console.error('SMTP Connection Error:', error);
    } else {
        console.log('SMTP Server is ready to take our messages');
    }
});

exports.sendValidateEmail = async (user, school, validationHash) => {
    try {

        await transporter.sendMail({
            from: '"E-scolar" <admin@escolar.site>',
            to: user.email,
            subject: "Sua conta foi criada no E-scolar 🤝",
            html: `
            <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Complete Your Registration</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: Arial, sans-serif;">

                    <table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa; padding: 20px;">
                        <tr>
                        <td align="center">

                            <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border: 2px solid #5a8dee; border-radius: 8px; overflow: hidden;">
                            <tr>
                                <td align="center" style="background-color: #5a8dee; color: #ffffff; padding: 20px; font-size: 18px; font-weight: bold;">
                                Final Step to Activate Your Account
                                </td>
                            </tr>
                            
                            <tr>
                                <td style="padding: 20px; color: #333333; font-size: 16px;">
                                <p style="margin: 0 0 10px; color: #333333;">Dear <strong>${user.firstName}<strong>,</p>
                                <p style="margin: 0 0 10px; color: #333333;">Thank you for signing up with us! You're just one step away from activating your account.</p>
                                <p style="margin: 0 0 10px; color: #333333;">To complete your registration, please set up your password. This will ensure your account is secure and ready to use.</p>
                                <!-- Button -->
                                <p style="text-align: center; margin: 20px 0; color: #333333">
                                    <a href="${getFrontendUrl()}/auth/validate-account?hash=${validationHash}&email=${user.email}" 
                                    style="background-color: #5a8dee; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-size: 16px; display: inline-block;">Set Your Password</a>
                                </p>
                                <p style="margin: 0 0 10px; color: #333333;">Once your password is set, your account will be fully activated, and you'll gain full access to all our features and services.</p>
                                <p style="margin: 0; color: #333333;">If you have any questions or need assistance, feel free to reach out to our support team.</p>
                                </td>
                            </tr>

                            <tr>
                                <td align="center">
                                    <img style="margin: 0 0 10px; width: 150px;" src="https://e-scolar.vercel.app/_nuxt/e-scolar-logo.77469f72.png" alt="E-scolar Logo">
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="background-color: #f1f1f1; padding: 10px; color: #666666; font-size: 14px;">
                                <p style="margin: 0;">Best regards,</p>
                                <p style="margin: 0;">${school.name}</p>
                                </td>
                            </tr>
                            </table>

                        </td>
                        </tr>
                    </table>

                </body>
            </html>
            `
        });

    }
    catch (error) {
        throw error
    }
}