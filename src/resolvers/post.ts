import {
	Arg,
	Ctx,
	Field,
	InputType,
	Mutation,
	Query,
	Resolver,
	UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";
import { Post } from "../entities/Post";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@InputType()
class PostInput {
	@Field()
	title: string;
	@Field()
	text: string;
}

@Resolver()
export class PostResolver {
	@Query(() => [Post])
	async posts(
		@Arg("limit") limit: number,
		@Arg("cursor", () => String, { nullable: true }) cursor: string | null
	): Promise<Post[]> {
		const realLimit = Math.min(25, limit);
		const qb = getConnection()
			.getRepository(Post)
			.createQueryBuilder("p")
			.orderBy('"createdAt"', "DESC")
			.take(realLimit);
		if (cursor) {
			qb.where('"createdAt" < :cursor', { cursor: parseInt(cursor) });
		}
		return qb.getMany();
	}

	@Query(() => Post, { nullable: true })
	async post(@Arg("id") id: number): Promise<Post | undefined> {
		return await Post.findOne(id);
	}

	@Mutation(() => Post)
	@UseMiddleware(isAuth)
	async createPost(
		@Arg("input") input: PostInput,
		@Ctx() { req }: MyContext
	): Promise<Post> {
		return await Post.create({
			...input,
			creatorId: req.session.userId,
		}).save();
	}

	@Mutation(() => Post, { nullable: true })
	@UseMiddleware(isAuth)
	async updatePost(
		@Arg("id") id: number,
		@Arg("title", () => String, { nullable: true }) title: string
	): Promise<Post | null> {
		if (typeof id !== undefined) {
			if (typeof title !== undefined) {
				const post = await Post.findOne(id);
				if (!post) {
					return null;
				}
				post.title = title;
				await Post.save(post);
				return post;
			}
			return null;
		}
		return null;
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async deletePost(@Arg("id") id: number): Promise<boolean> {
		await Post.delete(id);
		return true;
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async deleteAllPost(): Promise<boolean> {
		await Post.delete({});
		return true;
	}
}
