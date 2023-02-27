import * as Test from "https://deno.land/std@0.173.0/testing/asserts.ts";
import Logger from "./logger.ts";

Deno.test("Logger", async t => {
	await t.step("Global Logger", () => {
		const info = Logger.info("Hello World");
		const warn = Logger.warn("Hello World");
		const error = Logger.error("Hello World");
		const debug = Logger.debug("Hello World");

		Test.assertEquals(info, null);
		Test.assertEquals(warn, null);
		Test.assertEquals(error, null);
		Test.assertEquals(debug, null);
	});

	await t.step("Logger instance", async t => {
		await t.step(t.name + " (default)", async () => {
			const log = new Logger("test", {
				fileTimeout: 0
			});

			await log.info("Hello World");

			const logFile = await Deno.readTextFile(log.absolutePath);
			const logFileLines = logFile.split("\n");
			Test.assertStrictEquals(logFileLines[0].includes("INFO"), true);
			Test.assertStrictEquals(logFileLines[0].includes("Hello World"), true);

			await Deno.remove(log.absolutePath);
		});

		await t.step(t.name + " (value)", async () => {
			const log = new Logger("test", {
				initValues: {
					"some_value": "test"
				},
				fileTimeout: 0
			});

			await log.error("Hello World");

			const logFile = await Deno.readTextFile(log.absolutePath);
			const logFileLines = logFile.split("\n");
			console.log(logFileLines);
			Test.assertStrictEquals(logFileLines[0].includes("ERROR"), true);
			Test.assertStrictEquals(logFileLines[0].includes("Hello World"), true);
			Test.assertStrictEquals(!!logFileLines.find(v => v.includes("some_value")), true);

			await Deno.remove(log.absolutePath);
		});

		await t.step(t.name + " (no save)", async () => {
			Deno.remove("./logs", { recursive: true });

			const log = new Logger("test", {
				shouldSaveConsole: false,
				fileTimeout: 0
			});

			await log.info("Hello World");

			Test.assertEquals(await Deno.stat(log.absolutePath).then(() => true).catch(() => false), false);
		});

		await t.step("File Timeout for inactivity", async () => {
			const timer = 50;
			const log = new Logger("test", {
				fileTimeout: timer
			});

			await log.info("Hello World");
			await new Promise(resolve => setTimeout(resolve, timer));
		});

		await t.step("File Timeout for inactivity (no save)", async () => {
			const timer = 50;
			const log = new Logger("test", {
				shouldSaveConsole: false,
				fileTimeout: timer
			});

			await log.info("Hello World");
		});
	}).finally(() => {
		Deno.remove("./logs", { recursive: true });
	});
});