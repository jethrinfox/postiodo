import "reflect-metadata";
import express from "express";
import { MikroORM } from "@mikro-orm/core";
import microConfig from "./mikro-orm.config";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { PingResolver } from "./resolvers/ping";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";

import redis from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import { COOKIE_NAME, __prod__ } from "./constants";
import cors from "cors";

const main = async () => {
	const RedisStore = connectRedis(session);
	const redisClient = redis.createClient();
	const orm = await MikroORM.init(microConfig);
	await orm.getMigrator().up();

	const app = express();

	app.use(
		cors({
			origin: "http://localhost:3000",
			credentials: true,
		})
	);
	app.use(
		session({
			name: COOKIE_NAME,
			secret: "ajlndqoiuyvznmgrutyazmxvñljaskdhj",
			resave: false,
			saveUninitialized: false,
			store: new RedisStore({
				client: redisClient,
				disableTouch: true,
			}),
			cookie: {
				httpOnly: true,
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
				secure: __prod__,
				sameSite: "lax",
			},
		})
	);

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [PingResolver, PostResolver, UserResolver],
			validate: false,
		}),
		context: ({ req, res }) => ({ em: orm.em, req, res }),
	});

	apolloServer.applyMiddleware({ app, cors: false });

	app.get("/", (_, res) => res.redirect("/graphql"));

	app.listen(4000, () => {
		console.log("Express running on port localhost:4000");
	});
};

main();
