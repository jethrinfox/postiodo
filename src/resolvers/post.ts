import {
	Arg,
	Ctx,
	Field,
	FieldResolver,
	InputType,
	Int,
	Mutation,
	ObjectType,
	Query,
	Resolver,
	Root,
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

@ObjectType()
class PaginatedPosts {
	@Field(() => [Post])
	posts: Post[];
	@Field()
	hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
	@FieldResolver(() => String)
	textSnippet(@Root() root: Post) {
		const maxChar = 97;
		if (root.text.length > maxChar) {
			root.text = root.text.substring(0, maxChar) + " . . .";
		}
		return root.text;
	}

	@Query(() => PaginatedPosts)
	async posts(
		@Arg("limit", () => Int) limit: number,
		@Arg("cursor", () => String, { nullable: true }) cursor: string | null
	): Promise<PaginatedPosts> {
		/// 20 -> 21
		const realLimit = Math.min(20, limit);
		const realLimitPlusOne = realLimit + 1;

		const qb = getConnection()
			.getRepository(Post)
			.createQueryBuilder("p")
			.orderBy('"createdAt"', "DESC")
			.take(realLimitPlusOne);
		if (cursor) {
			qb.where('"createdAt" < :cursor', {
				cursor: new Date(parseInt(cursor)),
			});
		}

		const posts = await qb.getMany();

		return {
			posts: posts.slice(0, realLimit),
			hasMore: posts.length === realLimitPlusOne,
		};
	}

	@Query(() => Post, { nullable: true })
	async post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
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
		@Arg("id", () => Int) id: number,
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
	async deletePost(@Arg("id", () => Int) id: number): Promise<boolean> {
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
