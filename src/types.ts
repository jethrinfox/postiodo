import { EntityManager } from "@mikro-orm/core";
import { Connection } from "@mikro-orm/core/connections";
import { IDatabaseDriver } from "@mikro-orm/core/drivers";
import { Request, Response } from "express";
import { SessionData } from "express-session";
import { Redis } from "ioredis";

export type MyContext = {
	em: EntityManager<any> & EntityManager<IDatabaseDriver<Connection>>;
	req: Request & { session: SessionData & { userId: number } };
	res: Response;
	redis: Redis;
};
