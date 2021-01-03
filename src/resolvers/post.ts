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
		@Arg("post", () => Int) postId: number,
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
			select p.*, 
			json_build_object(
				'id', u.id,
				'username', u.username,
				'email', u.email,
				'createdAt', u."createdAt",
				'updatedAt', u."updatedAt"
				) creator
			from post p
			inner join public.user u on u.id = p."creatorId"
			${cursor ? `where p."createdAt" < $2` : ""}
			order by p."createdAt" DESC
			limit $1
		`,
			replacements
		);

		// const qb = getConnection()
		// 	.getRepository(Post)
		// 	.createQueryBuilder("p")
		// 	.innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
		// 	.orderBy('p."createdAt"', "DESC")
		// 	.take(realLimitPlusOne);
		// if (cursor) {
		// 	qb.where('p."createdAt" < :cursor', {
		// 		cursor: new Date(parseInt(cursor)),
		// 	});
		// }

		// const posts = await qb.getMany();

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
