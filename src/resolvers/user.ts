import { MyContext } from "src/types";
import {
	Arg,
	Ctx,
	Field,
	Mutation,
	ObjectType,
	Query,
	Resolver,
} from "type-graphql";
import argon2 from "argon2";
import { User } from "../entities/User";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";

@ObjectType()
class FieldError {
	@Field()
	field: string;
	@Field()
	message: string;
}

@ObjectType()
class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => User, { nullable: true })
	user?: User;
}

@Resolver()
export class UserResolver {
	@Mutation(() => Boolean)
	async forgotPassword(
		@Arg("email") email: string,
		@Ctx() { em, redis }: MyContext
	) {
		const user = await em.findOne(User, { email });
		if (!user) return true;

		const token = v4();

		await redis.set(
			FORGET_PASSWORD_PREFIX + token,
			user.id,
			"ex",
			1000 * 60 * 60 * 24
		);

		await sendEmail(
			email,
			`<a href="http://localhost:3000/change-password/${token}">reset password</a>`
		);

		return true;
	}

	@Query(() => User, { nullable: true })
	async me(@Ctx() { em, req }: MyContext) {
		// not logged in
		if (!req.session.userId) {
			return null;
		}
		const user = await em.findOne(User, { id: req.session.userId });
		return user;
	}

	@Mutation(() => UserResponse)
	async register(
		@Arg("options") { email, username, password }: UsernamePasswordInput,
		@Ctx() { em, req }: MyContext
	): Promise<UserResponse> {
		const errors = validateRegister({ email, username, password });
		if (errors) return { errors };
		const hashedPassword = await argon2.hash(password);
		const user = em.create(User, {
			email,
			username,
			password: hashedPassword,
		});
		try {
			await em.persistAndFlush(user);
		} catch (error) {
			// duplicate username error
			if (error.code === "23505") {
				return {
					errors: [
						{
							field: "username",
							message: "username already exists",
						},
					],
				};
			}
		}

		req.session.userId = user.id;

		return { user };
	}

	@Mutation(() => UserResponse)
	async login(
		@Arg("usernameOrEmail") usernameOrEmail: string,
		@Arg("password") password: string,
		@Ctx() { em, req }: MyContext
	): Promise<UserResponse> {
		const user = await em.findOne(
			User,
			usernameOrEmail.includes("@")
				? { email: usernameOrEmail }
				: { username: usernameOrEmail }
		);

		if (!user) {
			return {
				errors: [
					{
						field: "usernameOrEmail",
						message: "that username or email doesn't exist",
					},
				],
			};
		}
		const validPassword = await argon2.verify(user.password, password);
		if (!validPassword) {
			return {
				errors: [
					{
						field: "password",
						message: "incorrect password",
					},
				],
			};
		}

		req.session.userId = user.id;

		return { user };
	}

	@Mutation(() => Boolean)
	logout(@Ctx() { req, res }: MyContext) {
		return new Promise((resolve) =>
			req.session.destroy((err) => {
				if (err) {
					console.log(err);
					resolve(false);
					return;
				}
				res.clearCookie(COOKIE_NAME);
				resolve(true);
			})
		);
	}
}
