import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
import path from "path";
import { Post } from "./entities/Post";
import { User } from "./entities/User";

export default {
	entities: [Post, User],
	dbName: "lireddit",
	user: "postgres",
	password: "12345678",
	type: "postgresql",
	debug: !__prod__,
	migrations: {
		path: path.join(__dirname, "./migrations"),
		pattern: /^[\w-]+\d+\.[tj]s$/,
	},
} as Parameters<typeof MikroORM.init>[0];
