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
import { User } from "../entities/User";
import { Vote } from "../entities/Vote";
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
	textSnippet(@Root() post: Post) {
		const maxChar = 97;
		if (post.text.length > maxChar) {
			post.text = post.text.substring(0, maxChar) + " . . .";
		}
		return post.text;
	}

	@FieldResolver(() => User)
	creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
		return userLoader.load(post.creatorId);
	}

	@FieldResolver(() => Int, { nullable: true })
	async voteStatus(
		@Root() post: Post,
		@Ctx() { voteLoader, req }: MyContext
	) {
		if (!req.session.userId) return null;
		const vote = await voteLoader.load({
			postId: post.id,
			userId: req.session.userId,
		});
		return vote ? vote.value : null;
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async vote(
		@Arg("postId", () => Int) postId: number,
		@Arg("value", () => Int) value: number,
		@Ctx() { req }: MyContext
	): Promise<Boolean> {
		const isUpVote = value !== -1;
		const realValue = isUpVote ? 1 : -1;
		const { userId } = req.session;

		try {
			const vote = await Vote.findOne({ where: { postId, userId } });

			if (vote && vote.value !== realValue) {
				await getConnection().transaction(async (tm) => {
					await tm.query(
						`
							update vote 
							set value = $1
							where "userId" = $2 and "postId" = $3;
					`,
						[realValue, userId, postId]
					);
					await tm.query(
						`
							update post
							set points = points + $1
							where id = $2;
					`,
						[2 * realValue, postId]
					);
				});
			} else if (!vote) {
				await getConnection().transaction(async (tm) => {
					await tm.query(
						`
							insert into vote ("userId", "postId", value)
							values ($1,$2,$3);
					`,
						[userId, postId, realValue]
					);
					await tm.query(
						`
							update post
							set points = points + $1
							where id = $2;
					`,
						[realValue, postId]
					);
				});
			} else return false;
		} catch (error) {
			console.error(error);
			return false;
		}
		return true;
	}

	@Query(() => PaginatedPosts)
	async posts(
		@Arg("limit", () => Int) limit: number,
		@Arg("cursor", () => String, { nullable: true }) cursor: string | null
	): Promise<PaginatedPosts> {
		/// 20 -> 21
		const realLimit = Math.min(50, limit);
		const realLimitPlusOne = realLimit + 1;

		const replacements: any[] = [realLimitPlusOne];

		if (cursor) {
			replacements.push(new Date(parseInt(cursor)));
		}

		const posts = await getConnection().query(
			`
			select p.*
			from post p
			${cursor ? 'where p."createdAt" < $2' : ""}
			order by p."createdAt" DESC
			limit $1
		`,
			replacements
		);
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
		@Arg("input") { text, title }: PostInput,
		@Ctx() { req }: MyContext
	): Promise<Post | null> {
		const result = await getConnection()
			.createQueryBuilder()
			.update(Post)
			.set({ text, title })
			.where('id = :id and "creatorId" = :creatorId', {
				id,
				creatorId: req.session.userId,
			})
			.returning("*")
			.execute();

		if (!result.raw) return null;
		return result.raw[0];
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async deletePost(
		@Arg("id", () => Int) id: number,
		@Ctx() { req }: MyContext
	): Promise<boolean> {
		await Post.delete({ id, creatorId: req.session.userId });
		return true;
	}
}
