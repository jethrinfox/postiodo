"use strict";
import nodemailer from "nodemailer";

// async..await is not allowed in global scope, must use a wrapper
export const sendEmail = async (to: string, html: string) => {
	// Generate test SMTP service account from ethereal.email
	// Only needed if you don't have a real mail account for testing
	// let testAccount = await nodemailer.createTestAccount();
	// console.log("testAccount: ", testAccount);
	const user = "r6r2kh7gz3hagwk2@ethereal.email";
	const pass = "RKrxvA4XBQRHwwu2Ag";
	// create reusable transporter object using the default SMTP transport
	const transporter = nodemailer.createTransport({
		host: "smtp.ethereal.email",
		port: 587,
		secure: false, // true for 465, false for other ports
		auth: {
			user,
			pass,
		},
		tls: {
			rejectUnauthorized: false,
		},
	});

	try {
		const info = await transporter.sendMail({
			from: '"Fred Foo 👻" <foo@example.com>',
			to,
			subject: "Change password",
			html,
		});
		console.log("Message sent: %s", info.messageId);
		console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
	} catch (err) {
		console.error(err);
	}
};
