import { UsernamePasswordInput } from "../resolvers/UsernamePasswordInput";

export const validateRegister = ({
	email,
	username,
	password,
}: UsernamePasswordInput) => {
	if (!email.includes("@")) {
		return [
			{
				field: "email",
				message: "invalid email",
			},
		];
	}
	if (username.includes("@")) {
		return [
			{
				field: "username",
				message: "cannot include @",
			},
		];
	}
	if (username.length <= 2) {
		return [
			{
				field: "username",
				message: "username length must be greater than 2",
			},
		];
	}
	if (password.length <= 2) {
		return [
			{
				field: "password",
				message: "password length must be greater than 2",
			},
		];
	}
	return null;
};
