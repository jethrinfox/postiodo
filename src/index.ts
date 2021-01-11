import { ApolloServer } from "apollo-server-express";
import connectRedis from "connect-redis";
import cors from "cors";
import "dotenv-safe/config";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
import path from "path";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";
import { COOKIE_NAME, PORT, __prod__ } from "./config";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { Vote } from "./entities/Vote";
import { PingResolver } from "./resolvers/ping";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { createUserLoader } from "./utils/createUserLoader";
import { createVoteLoader } from "./utils/createVoteLoader";

const main = async () => {
	const conn = await createConnection({
		type: "postgres",
		url: process.env.DATABASE_URL,
		synchronize: true,
		logging: true,
		entities: [Post, User, Vote],
		migrations: [path.join(__dirname, "./migrations/*")],
	});

	conn.runMigrations();

	const RedisStore = connectRedis(session);
	const redis = new Redis(process.env.REDIS_URL);

	const app = express();

	app.use(
		cors({
			origin: process.env.CORS_ORIGIN,
			credentials: true,
		})
	);
	app.use(
		session({
			name: COOKIE_NAME,
			secret: process.env.SESSION_SECRET,
			resave: false,
			saveUninitialized: false,
			store: new RedisStore({
				client: redis,
				disableTouch: true,
			}),
			cookie: {
				httpOnly: true,
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
				secure: __prod__,
				sameSite: "lax",
				domain: __prod__ ? ".jethrinfox.ddns.net" : undefined,
			},
		})
	);

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [PingResolver, PostResolver, UserResolver],
			validate: false,
		}),
		context: ({ req, res }) => ({
			req,
			res,
			redis,
			userLoader: createUserLoader(),
			voteLoader: createVoteLoader(),
		}),
	});

	apolloServer.applyMiddleware({ app, cors: false });

	app.get("/", (_, res) => res.redirect("/graphql"));

	app.listen(PORT, () =>
		console.log(`Server running on http://localhost:${PORT}`)
	);
};

main();
