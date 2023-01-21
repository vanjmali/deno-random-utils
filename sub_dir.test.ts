import * as Path from "https://deno.land/std@0.173.0/path/mod.ts";
import * as Test from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { DirUtils } from "./sub_dir.ts";

Deno.test("Get All files in Sub Directories", async (t) => {
	//> Create directories for testing
	const path = await Deno.makeTempDir();

	const sourceEntries = [
		Path.join(path, "folder1"),
		Path.join(path, "folder2"),
		Path.join(path, "folder3"),
		Path.join(path, "folder1", "folder4"),
		Path.join(path, "folder1", "file1.txt"),
		Path.join(path, "folder1", "file2.txt"),
		Path.join(path, "file3.txt"),
		Path.join(path, "folder3", "file4.txt"),
		Path.join(path, "folder1", "file5.txt"),
		Path.join(path, "folder1", "folder4", "file6.txt"),
	];

	for await (const entry of sourceEntries) {
		const file = await Deno[entry.endsWith(".txt") ? "create" : "mkdir"](
			entry,
		);
		!!file && file.close();
	}

	//> Get all files in the temp folder
	await t.step("List all files within directory", async (_) => {
		const entries = await DirUtils.readSubDir(path).then((v) =>
			v.map((v) => v.path)
		);
		Test.assertArrayIncludes(
			entries,
			sourceEntries.filter((v) => v.endsWith(".txt")),
		);
	});

	//> Remove temp dir
	await Deno.remove(path, { recursive: true });
});
