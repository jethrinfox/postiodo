import { EntityManager } from "@mikro-orm/core";
import { Connection } from "@mikro-orm/core/connections";
import { IDatabaseDriver } from "@mikro-orm/core/drivers";
import { Request, Response } from "express";
import { Session } from "express-session";

export type MyContext = {
	em: EntityManager<any> & EntityManager<IDatabaseDriver<Connection>>;
	req: Request & { session: Session & { userId?: number } };
	res: Response;
};
