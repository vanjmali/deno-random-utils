import * as Path from "https://deno.land/std@0.173.0/path/mod.ts";

export class DirUtils {
	/**
	 * Gets a list of all files in a directory inclusing sub-directories
	 *
	 * Uses {@link Deno.readDir}
	 * @returns All files referenced as {@link Deno.DirEntry}
	 */
	public static readSubDir = (path: string) => this._readSubDir(path, []);

	private static async _readSubDir(path: string, filesRead: SubDirEntry[]) {
		for await (const entry of Deno.readDir(path)) {
			// If entry is directory, read files in it and add it to the list
			entry.isDirectory &&
				filesRead.push(
					...await this._readSubDir(Path.join(path, entry.name), []),
				);

			// If entry is file then add it to the list
			entry.isFile && filesRead.push({
				name: entry.name,
				direcotry: path,
				path: Path.isAbsolute(entry.name)
					? entry.name
					: Path.join(path, entry.name),
			});
		}

		return filesRead;
	}
}

interface SubDirEntry {
	name: string;
	direcotry: string;
	path: string;
}
