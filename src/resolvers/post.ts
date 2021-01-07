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
	textSnippet(@Root() root: Post) {
		const maxChar = 97;
		if (root.text.length > maxChar) {
			root.text = root.text.substring(0, maxChar) + " . . .";
		}
		return root.text;
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
		@Arg("cursor", () => String, { nullable: true }) cursor: string | null,
		@Ctx() { req }: MyContext
	): Promise<PaginatedPosts> {
		/// 20 -> 21
		const realLimit = Math.min(50, limit);
		const realLimitPlusOne = realLimit + 1;

		const replacements: any[] = [realLimitPlusOne];

		if (req.session.userId) {
			replacements.push(req.session.userId);
		}
		let cursorIdx = 3;
		if (cursor) {
			replacements.push(new Date(parseInt(cursor)));
			cursorIdx = replacements.length;
		}

		const posts = await getConnection().query(
			`
			select p.*, 
			json_build_object(
				'id', u.id,
				'username', u.username,
				'email', u.email,
				'createdAt', u."createdAt",
				'updatedAt', u."updatedAt"
				) creator,
			${
				req.session.userId
					? `(select value from vote where "userId" = $2 and "postId" = p.id) "voteStatus"`
					: 'null as "voteStatus"'
			}
			from post p
			inner join public.user u on u.id = p."creatorId"
			${cursor ? `where p."createdAt" < $${cursorIdx}` : ""}
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
		return await Post.findOne(id, { relations: ["creator"] });
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
